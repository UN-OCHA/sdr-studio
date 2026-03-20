import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import { Divider, H6, Icon, Text } from '@blueprintjs/core';
import type { Article } from '../types';
import type { SelectionState } from './CoverageView';

// Provided Mapbox Token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

type MapViewProps = {
  articles: Article[];
  selection: SelectionState | null;
  onArticleClick: (id: string) => void;
};

/**
 * Component to render the popup content with highlighted location.
 */
function PopupContent({ article, locationName, excerpt }: { article: Article, locationName: string, excerpt: string }) {
  const parts = excerpt.split(new RegExp(`(${locationName})`, 'gi'));
  
  return (
    <div className="flex flex-col gap-1 p-1 min-w-[200px]">
      <H6 className="mb-0 leading-tight text-gray-900">{article.title}</H6>
      <Text className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">{locationName}</Text>
      
      {excerpt && (
        <>
          <Divider className="my-1" />
          <div className="text-gray-600 text-xs italic leading-relaxed">
            "
            {parts.map((part, i) => 
              part.toLowerCase() === locationName.toLowerCase() ? (
                <strong key={i} className="text-blue-700 bg-blue-50 px-0.5 rounded font-bold">{part}</strong>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
            "
          </div>
        </>
      )}
      
      <Divider className="my-1" />
      <a 
        href={article.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-600 hover:underline text-xs font-semibold self-end"
      >
        View Source →
      </a>
    </div>
  );
}

function getExcerpt(content: string, locationName: string, maxLength = 160): string {
  if (!content || !locationName) return "";
  const index = content.toLowerCase().indexOf(locationName.toLowerCase());
  if (index === -1) return content.substring(0, maxLength) + "...";
  const start = Math.max(0, index - Math.floor(maxLength / 2));
  const end = Math.min(content.length, start + maxLength);
  let excerpt = content.substring(start, end).trim();
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";
  return excerpt;
}

export function MapView({ articles, selection, onArticleClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Record<string, mapboxgl.Marker[]>>({});
  
  // Keep onArticleClick fresh for the marker callbacks without re-adding markers
  const onArticleClickRef = useRef(onArticleClick);
  useEffect(() => {
    onArticleClickRef.current = onArticleClick;
  }, [onArticleClick]);

  const allLocations = articles.flatMap(a => (a.locations || []).map(l => ({ ...l, article: a })));

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let center: [number, number] = [0, 0];
    if (allLocations.length > 0) {
      const avgLat = allLocations.reduce((acc, loc) => acc + loc.latitude, 0) / allLocations.length;
      const avgLng = allLocations.reduce((acc, loc) => acc + loc.longitude, 0) / allLocations.length;
      center = [avgLng, avgLat];
    }

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: center,
      zoom: allLocations.length > 0 ? 3 : 1,
      trackResize: true
    });

    m.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current = m;

    const resizeObserver = new ResizeObserver(() => m.resize());
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      Object.values(markers.current).flat().forEach(mark => mark.remove());
      m.remove();
      map.current = null;
    };
  }, []);

  // 2. Handle Data Updates (Markers)
  useEffect(() => {
    if (!map.current) return;
    Object.values(markers.current).flat().forEach(m => m.remove());
    markers.current = {};

    allLocations.forEach((loc) => {
      const excerpt = getExcerpt(loc.article.content, loc.name);
      const popupNode = document.createElement('div');
      createRoot(popupNode).render(<PopupContent article={loc.article} locationName={loc.name} excerpt={excerpt} />);
      const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '300px' }).setDOMContent(popupNode);

      const el = document.createElement('div');
      el.className = 'custom-marker';
      
      // We don't stopPropagation here anymore, so Mapbox's internal 
      // click listener for markers can still fire to open the popup.
      el.onclick = () => {
          onArticleClickRef.current(loc.article.id);
      };

      createRoot(el).render(
        <div className="marker-container">
            <div className="marker-pin">
                <Icon icon="map-marker" size={24} color="#2B6693" />
            </div>
            <div className="marker-pulse" />
        </div>
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(popup)
        .addTo(map.current!);
      
      if (!markers.current[loc.article.id]) markers.current[loc.article.id] = [];
      markers.current[loc.article.id].push(marker);
    });

    if (allLocations.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        allLocations.forEach(loc => bounds.extend([loc.longitude, loc.latitude]));
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 8, animate: false });
    }
  }, [articles]);

  // 3. Handle External Selection (Sync from Timeline)
  useEffect(() => {
    if (!map.current || !selection || !markers.current[selection.id]) return;

    // Only move camera and toggle popups if selection came from the timeline.
    // If it came from the map, the user is already looking at the location 
    // and Mapbox's internal listener handles the popup for the clicked marker.
    if (selection.source === 'timeline') {
        const articleMarkers = markers.current[selection.id];
        if (articleMarkers.length > 0) {
            if (articleMarkers.length === 1) {
                map.current.easeTo({
                    center: articleMarkers[0].getLngLat(),
                    zoom: Math.max(map.current.getZoom(), 7),
                    duration: 800
                });
            } else {
                const bounds = new mapboxgl.LngLatBounds();
                articleMarkers.forEach(m => bounds.extend(m.getLngLat()));
                map.current.fitBounds(bounds, { padding: 100, maxZoom: 8, duration: 1000 });
            }

            // Open the preview popup for the first location of this article
            const firstMarker = articleMarkers[0];
            const popup = firstMarker.getPopup();
            if (popup && !popup.isOpen()) {
                firstMarker.togglePopup();
            }
        }
    }
  }, [selection]);

  if (allLocations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 p-8 text-center">
        <div className="max-w-xs">
            <Text className="text-gray-400 font-medium italic mb-2">No geocoded locations available.</Text>
            <Text className="text-gray-400 text-xs">Articles must have identified locations and successful geocoding to appear on the map.</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      <style>{`
        .mapboxgl-map { overflow: visible !important; }
        .mapboxgl-popup-content {
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.25);
          font-family: inherit;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .mapboxgl-popup-close-button {
          padding: 6px 10px;
          font-size: 18px;
          color: #666;
          border-radius: 0 8px 0 0;
        }
        .mapboxgl-popup-close-button:hover { background-color: #f5f5f5; }
        .marker-container {
            position: relative;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .marker-pin {
            z-index: 2;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .marker-container:hover .marker-pin {
            transform: translateY(-4px) scale(1.1);
        }
        .marker-pulse {
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 6px;
            background: rgba(0,0,0,0.2);
            border-radius: 50%;
            z-index: 1;
            transition: all 0.2s ease;
        }
        .marker-container:hover .marker-pulse {
            transform: translateX(-50%) scale(1.5);
            background: rgba(0,0,0,0.1);
            filter: blur(2px);
        }
        .mapboxgl-popup { z-index: 1000; }
      `}</style>
    </div>
  );
}
