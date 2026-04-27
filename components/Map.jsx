import Map, { Marker, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const STATUS_COLORS = {
  interested: "#22c55e",
  not_interested: "#ef4444",
  unknown: "#94a3b8",
};

function FamilyMarker({ family, selected, onClick }) {
  const color = STATUS_COLORS[family.status] ?? STATUS_COLORS.unknown;

  return (
    <Marker
      longitude={family.lng}
      latitude={family.lat}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(family);
      }}
    >
      <div
        style={{
          width: selected ? 16 : 12,
          height: selected ? 16 : 12,
          borderRadius: "50%",
          background: color,
          border: "2px solid #0b1220",
          boxShadow: selected
            ? `0 0 0 3px ${color}66, 0 1px 6px rgba(0,0,0,0.35)`
            : "0 1px 4px rgba(0,0,0,0.28)",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      />
    </Marker>
  );
}

export default function FamilyMap({ families, selectedId, onSelectFamily }) {
  const mappable = families.filter((f) => f.lat != null && f.lng != null);

  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: -73.9857, latitude: 40.7128, zoom: 10.5 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
    >
      <NavigationControl position="top-right" showCompass={false} />

      {mappable.map((f) => (
        <FamilyMarker
          key={f.id}
          family={f}
          selected={selectedId === f.id}
          onClick={onSelectFamily}
        />
      ))}
    </Map>
  );
}
