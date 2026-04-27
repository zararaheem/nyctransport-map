// lib/data.js
// Fetches rows from Google Sheets and geocodes addresses via Mapbox

const { google } = require("googleapis");

// ─── Geocoding ───────────────────────────────────────────────────────────────

const geocodeCache = new Map();

export async function geocodeAddress(rawAddress) {
  const query = rawAddress.trim();
  if (!query) return null;

  // Append NYC context if not already present
  const fullQuery = /new york|nyc|ny\b/i.test(query)
    ? query
    : `${query}, New York City, NY`;

  if (geocodeCache.has(fullQuery)) return geocodeCache.get(fullQuery);

  const url = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(fullQuery) + ".json");
  url.searchParams.set("access_token", process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  url.searchParams.set("country", "US");
  url.searchParams.set("bbox", "-74.2591,40.4774,-73.7002,40.9176"); // NYC bounding box
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
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = typeof raw === "string" ? JSON.parse(raw) : raw;

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function fetchFamilies() {
  const colName     = parseInt(process.env.COL_NAME     ?? "0");
  const colAddress  = parseInt(process.env.COL_ADDRESS  ?? "1");
  const colInterest = parseInt(process.env.COL_INTEREST ?? "2");
  const startRow    = parseInt(process.env.DATA_START_ROW ?? "2");

  const auth   = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1", // adjust if your tab has a different name
  });

  const rows = response.data.values ?? [];
  const dataRows = rows.slice(startRow - 1); // skip header rows

  const families = await Promise.all(
    dataRows.map(async (row, i) => {
      const name       = row[colName]?.trim()     || `Family ${i + 1}`;
      const rawAddress = row[colAddress]?.trim()  || "";
      const interest   = row[colInterest]?.trim() || "";

      // Normalise yes/no — handles "Yes", "yes", "YES", "y", "1", "true"
      const interestedRaw = interest.toLowerCase();
      const status =
        ["yes", "y", "1", "true", "interested"].includes(interestedRaw)
          ? "interested"
          : ["no", "n", "0", "false", "not interested"].includes(interestedRaw)
          ? "not_interested"
          : "unknown";

      const geo = rawAddress ? await geocodeAddress(rawAddress) : null;

      return {
        id: i,
        name,
        rawAddress,
        displayAddress: geo?.displayAddress || rawAddress,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        geocoded: !!geo,
        status,
      };
    })
  );

  return families;
}
