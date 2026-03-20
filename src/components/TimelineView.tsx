import { useEffect, useRef } from "react";
import { Button, Card, Divider, Elevation, H6, Tag, Text } from "@blueprintjs/core";
import type { Article } from "../types";

type TimelineViewProps = {
  articles: Article[];
  activeArticleId: string | null;
  onArticleClick: (id: string) => void;
};

export function TimelineView({ articles, activeArticleId, onArticleClick }: TimelineViewProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sort articles by event_date if present, otherwise by created_at
  const sortedArticles = [...articles].sort((a, b) => {
    const dateA = new Date(a.event_date || a.created_at).getTime();
    const dateB = new Date(b.event_date || b.created_at).getTime();
    return dateB - dateA; // Newest first
  });

  // Scroll into view when activeArticleId changes from an external source (like the map)
  useEffect(() => {
    if (activeArticleId && cardRefs.current[activeArticleId]) {
      cardRefs.current[activeArticleId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeArticleId]);

  return (
    <div className="p-4 bg-gray-50 min-h-full">
      <div className="relative ml-4 pl-8 border-l-2 border-gray-200 py-4 flex flex-col gap-8">
        {sortedArticles.map((article) => {
          const displayDate = new Date(article.event_date || article.created_at);
          const hasLocation = (article.locations || []).length > 0;
          const isActive = activeArticleId === article.id;

          return (
            <div 
              key={article.id} 
              className="relative"
              ref={(el) => { cardRefs.current[article.id] = el; }}
            >
              {/* Timeline marker */}
              <div className={`absolute -left-[41px] top-4 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10 transition-colors ${
                isActive ? "bg-blue-600 scale-125" : "bg-blue-400"
              }`} />
              
              <Card 
                elevation={isActive ? Elevation.FOUR : Elevation.ONE} 
                className={`hover:shadow-md transition-all cursor-pointer ${
                  isActive ? "ring-2 ring-blue-500 ring-offset-2" : ""
                }`}
                onClick={() => onArticleClick(article.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <Tag minimal intent={isActive ? "primary" : "none"} icon="calendar">
                    {displayDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Tag>
                  <Text className="text-gray-400 text-xs font-mono">
                    {displayDate.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </div>

                <H6 className={`mb-2 leading-tight transition-colors ${isActive ? "text-blue-700" : ""}`}>
                  {article.title}
                </H6>

                {article.summary && (
                  <Text ellipsize className="text-gray-600 text-sm mb-3">
                    {article.summary}
                  </Text>
                )}

                <Divider className="my-3" />

                <div className="flex justify-between items-center">
                  <div className="flex gap-1 overflow-hidden">
                    {hasLocation && article.locations?.slice(0, 2).map((loc, idx) => (
                      <Tag key={idx} minimal icon="map-marker" className="text-[10px] shrink-0">
                        {loc.name}
                      </Tag>
                    ))}
                    {article.locations && article.locations.length > 2 && (
                      <Tag minimal className="text-[10px]">+{article.locations.length - 2}</Tag>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                        minimal 
                        small 
                        icon="locate" 
                        intent={isActive ? "primary" : "none"}
                        onClick={(e) => {
                            e.stopPropagation();
                            onArticleClick(article.id);
                        }}
                    />
                    <Button 
                        minimal 
                        small 
                        icon="share" 
                        intent="primary" 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(article.url, '_blank');
                        }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
