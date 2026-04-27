import Map, { Marker, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const INTERESTED_COLOR = "#22c55e";
const OTHER_COLORS = {
  not_interested: "#ef4444",
  unknown:        "#94a3b8",
};

function InterestedMarker({ family, selected, onClick }) {
  return (
    <Marker
      longitude={family.lng}
      latitude={family.lat}
      anchor="bottom"
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(family); }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
        <div
          style={{
            background: selected ? INTERESTED_COLOR : "#fff",
            color:      selected ? "#fff" : "#0f172a",
            border:     `2px solid ${INTERESTED_COLOR}`,
            borderRadius: 6,
            padding:    "2px 8px",
            fontSize:   11,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: "nowrap",
            boxShadow:  selected
              ? `0 0 0 3px ${INTERESTED_COLOR}33, 0 2px 8px rgba(0,0,0,0.18)`
              : "0 2px 6px rgba(0,0,0,0.12)",
            marginBottom: 3,
            transition: "all 0.15s",
          }}
        >
          {family.firstName}
        </div>
        <div
          style={{
            width:        selected ? 14 : 11,
            height:       selected ? 14 : 11,
            borderRadius: "50%",
            background:   INTERESTED_COLOR,
            border:       "2.5px solid #fff",
            boxShadow:    selected
              ? `0 0 0 3px ${INTERESTED_COLOR}44`
              : "0 1px 4px rgba(0,0,0,0.22)",
            transition: "all 0.15s",
          }}
        />
      </div>
    </Marker>
  );
}

function OtherMarker({ family, selected, onClick }) {
  const color = OTHER_COLORS[family.status] ?? "#94a3b8";
  return (
    <Marker
      longitude={family.lng}
      latitude={family.lat}
      anchor="center"
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(family); }}
    >
      <div
        style={{
          width:        selected ? 13 : 10,
          height:       selected ? 13 : 10,
          borderRadius: "50%",
          background:   color,
          border:       "2px solid #fff",
          boxShadow:    selected
            ? `0 0 0 3px ${color}55`
            : "0 1px 3px rgba(0,0,0,0.2)",
          cursor:     "pointer",
          transition: "all 0.15s",
        }}
      />
    </Marker>
  );
}

export default function FamilyMap({ families, selectedId, onSelectFamily }) {
  const mappable   = families.filter((f) => f.lat && f.lng);
  const interested = mappable.filter((f) => f.status === "interested");
  const others     = mappable.filter((f) => f.status !== "interested");

  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: -73.9857, latitude: 40.7128, zoom: 10.5 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      <NavigationControl position="top-right" showCompass={false} />

      {others.map((f) => (
        <OtherMarker
          key={f.id}
          family={f}
          selected={selectedId === f.id}
          onClick={onSelectFamily}
        />
      ))}

      {interested.map((f) => (
        <InterestedMarker
          key={f.id}
          family={f}
          selected={selectedId === f.id}
          onClick={onSelectFamily}
        />
      ))}
    </Map>
  );
}
