import { Button, MenuItem, type IconName } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import {
  Select,
  type ItemListPredicate,
  type ItemRenderer,
} from "@blueprintjs/select";
import { useCallback, useState } from "react";

// 1. Initialize static data outside the component to prevent recreation
const ALL_ICONS = Object.values(IconNames);

// 2. Hoist the renderer for a stable reference
const renderIcon: ItemRenderer<string> = (
  icon,
  { handleClick, handleFocus, modifiers },
) => {
  return (
    <MenuItem
      active={modifiers.active}
      key={icon}
      onClick={handleClick}
      onFocus={handleFocus}
      text={icon}
      icon={icon as IconName}
      roleStructure="listoption"
    />
  );
};

// 3. Hoist the predicate for a stable reference and peak performance
const filterIcons: ItemListPredicate<string> = (query, items) => {
  const normalizedQuery = query.toLowerCase().trim();

  // Return a fast, sliced default list if the user hasn't typed anything yet
  if (!normalizedQuery) {
    return items.slice(0, 100);
  }

  const exactMatch = items.find(
    (icon) => icon.toLowerCase() === normalizedQuery,
  );
  const filtered = items.filter((icon) =>
    icon.toLowerCase().includes(normalizedQuery),
  );

  const results = exactMatch
    ? [exactMatch, ...filtered.filter((icon) => icon !== exactMatch)]
    : filtered;

  return results.slice(0, 100);
};

type IconPickerProps = {
  selectedIcon?: string; // Made optional for initial empty states
  onSelect: (icon: string) => void;
};

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const [query, setQuery] = useState("");

  // 4. Memoize the selection handler
  const handleItemSelect = useCallback(
    (icon: string) => {
      onSelect(icon);
      setQuery(""); // Clear the search bar after picking an icon
    },
    [onSelect],
  );

  return (
    <Select<string>
      items={ALL_ICONS}
      itemRenderer={renderIcon}
      itemListPredicate={filterIcons}
      query={query}
      onQueryChange={setQuery}
      onItemSelect={handleItemSelect}
      popoverProps={{ minimal: true, matchTargetWidth: true }}
      filterable={true}
      resetOnQuery={true}
      resetOnSelect={true}
      // 5. Provide a graceful fallback for zero search results
      noResults={
        <MenuItem
          disabled={true}
          text={`No icons found for "${query}"`}
          roleStructure="listoption"
        />
      }
    >
      <Button
        icon={(selectedIcon as IconName) || "help"} // Fallback icon
        text={selectedIcon || "Select an icon..."} // Fallback text
        rightIcon="double-caret-vertical"
        fill
        alignText="left"
      />
    </Select>
  );
}
