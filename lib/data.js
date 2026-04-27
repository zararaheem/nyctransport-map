// Fetches rows from Google Sheets and geocodes addresses via Mapbox

import { google } from "googleapis";

// ─── Geocoding ────────────────────────────────────────────────────────────────

const geocodeCache = new Map();

export async function geocodeAddress(rawAddress) {
  const query = rawAddress.trim();
  if (!query) return null;

  const fullQuery = /new york|nyc|ny\b/i.test(query)
    ? query
    : `${query}, New York City, NY`;

  if (geocodeCache.has(fullQuery)) return geocodeCache.get(fullQuery);

  const url = new URL(
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(fullQuery) +
      ".json"
  );
  const mapboxToken = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) throw new Error("Mapbox token is not configured");
  url.searchParams.set("access_token", mapboxToken);
  url.searchParams.set("country", "US");
  url.searchParams.set("bbox", "-74.2591,40.4774,-73.7002,40.9176");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    const result = {
      lng: feature.center[0],
      lat: feature.center[1],
      displayAddress: feature.place_name,
    };
    geocodeCache.set(fullQuery, result);
    return result;
  } catch (err) {
    console.error("Geocode error for:", query, err);
    return null;
  }
}

// ─── Google Sheets ────────────────────────────────────────────────────────────

function getAuthClient() {
  let credentials;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    credentials = typeof raw === "string" ? JSON.parse(raw) : raw;
  } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, "\n"),
    };
  } else {
    throw new Error(
      "Missing Google credentials: set GOOGLE_SERVICE_ACCOUNT_JSON OR both GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY"
    );
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function formatSheetsError(err) {
  const code = err?.code || err?.response?.status;
  const details =
    err?.response?.data?.error?.message ||
    err?.message ||
    "Unknown Google Sheets error";

  if (code === 404 || /Requested entity was not found/i.test(details)) {
    return (
      "Google Sheet not found. Verify GOOGLE_SHEET_ID and SHEET_TAB_NAME, and " +
      "share the spreadsheet with your service account email."
    );
  }

  if (code === 403 || /permission/i.test(details)) {
    return "Google Sheets permission denied. Share the sheet with the service account email.";
  }

  return `Google Sheets request failed: ${details}`;
}

export async function fetchFamilies() {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID is not set");
  }
  if (/^\d+$/.test(process.env.GOOGLE_SHEET_ID)) {
    throw new Error(
      "GOOGLE_SHEET_ID looks like a tab gid. Use the spreadsheet id from the URL segment between /d/ and /edit."
    );
  }

  const colName     = parseInt(process.env.COL_NAME      ?? "0");
  const colLastName = parseInt(process.env.COL_LAST_NAME ?? "-1");
  const colAddress  = parseInt(process.env.COL_ADDRESS   ?? "1");
  const colInterest = parseInt(process.env.COL_INTEREST  ?? "2");
  const startRow    = parseInt(process.env.DATA_START_ROW ?? "2");

  const auth   = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.SHEET_TAB_NAME ?? "Sheet1",
    });
  } catch (err) {
    throw new Error(formatSheetsError(err));
  }

  const rows     = response.data.values ?? [];
  const dataRows = rows.slice(startRow - 1);

  const families = await Promise.all(
    dataRows.map(async (row, i) => {
      const firstName  = row[colName]?.trim() || "";
      const lastName   = colLastName >= 0 ? row[colLastName]?.trim() || "" : "";
      const name       = [firstName, lastName].filter(Boolean).join(" ") || `Student ${i + 1}`;
      const rawAddress = row[colAddress]?.trim()  || "";
      const interest   = row[colInterest]?.trim() || "";

      const interestedRaw = interest.toLowerCase();
      const status =
        ["yes", "y", "1", "true", "interested"].includes(interestedRaw)
          ? "interested"
          : ["no", "n", "0", "false", "not interested"].includes(interestedRaw)
          ? "not_interested"
          : "unknown";

      const geo = rawAddress ? await geocodeAddress(rawAddress) : null;

      return {
        id:             i,
        name,
        firstName:      name.split(/\s+/)[0],
        rawAddress,
        displayAddress: geo?.displayAddress || rawAddress,
        lat:            geo?.lat ?? null,
        lng:            geo?.lng ?? null,
        geocoded:       !!geo,
        status,
      };
    })
  );

  return families;
}
