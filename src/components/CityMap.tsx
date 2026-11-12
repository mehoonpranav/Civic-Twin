import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import type { Severity } from "@/lib/constants";
import { DEFAULT_CENTER } from "@/lib/constants";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  label: string;
}

const severityHex: Record<Severity, string> = {
  low: "#5a8a5c",
  moderate: "#c9932a",
  high: "#d06a28",
  critical: "#c4392f",
};

interface CityMapProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMarkerClick?: (id: string) => void;
  onPickLocation?: (lat: number, lng: number) => void;
  picked?: { lat: number; lng: number } | null;
  className?: string;
}

export function CityMap({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = 12,
  onMarkerClick,
  onPickLocation,
  picked,
  className,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const lastView = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const onPickRef = useRef(onPickLocation);
  onPickRef.current = onPickLocation;
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | null = null;

    void import("maplibre-gl").then((ml) => {
      if (cancelled || !containerRef.current) return;
      map = new ml.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [center.lng, center.lat],
        zoom,
        attributionControl: true,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("click", (e: maplibregl.MapMouseEvent) => {
        onPickRef.current?.(e.lngLat.lat, e.lngLat.lng);
      });
      mapRef.current = map;
      lastView.current = { lat: center.lat, lng: center.lng, zoom };
      setReady(true);
    });

    return () => {
      cancelled = true;
      setReady(false);
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the requested center/zoom changes (e.g. GPS capture or pin drop)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const last = lastView.current;
    if (
      last &&
      Math.abs(last.lat - center.lat) < 1e-7 &&
      Math.abs(last.lng - center.lng) < 1e-7 &&
      last.zoom === zoom
    ) {
      return;
    }
    lastView.current = { lat: center.lat, lng: center.lng, zoom };
    map.easeTo({ center: [center.lng, center.lat], zoom, duration: 700 });
  }, [center.lat, center.lng, zoom, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = markers.map((mk) => {
        const el = document.createElement("button");
        el.className = "map-marker";
        el.style.background = severityHex[mk.severity];
        el.title = mk.label;
        el.setAttribute("aria-label", mk.label);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onClickRef.current?.(mk.id);
        });
        return new ml.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(map);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled) return;
      pickRef.current?.remove();
      pickRef.current = null;
      if (picked) {
        const el = document.createElement("div");
        el.className = "map-marker";
        el.style.background = "#0f6a5c";
        pickRef.current = new ml.Marker({ element: el, draggable: true })
          .setLngLat([picked.lng, picked.lat])
          .addTo(map);
        pickRef.current.on("dragend", () => {
          const ll = pickRef.current!.getLngLat();
          onPickRef.current?.(ll.lat, ll.lng);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [picked, ready]);

  return <div ref={containerRef} className={className} />;
}
