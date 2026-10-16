"use client";

import { Footprints } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChoiceCard, ChoiceGroup } from "./choice-cards";

export type CityChoice = { id: string; name: string; /** `live` has every data source; `less` is missing some. */ level: "live" | "less"; note: string };

/** Where the busk is. One city today (Melbourne), so one card; it is the same picker the next cities will use. */
export function CityPicker({ cities, value, onValueChange, label = "City" }: { cities: CityChoice[]; value: string; onValueChange: (id: string) => void; label?: string }) {
  return (
    <ChoiceGroup legend={label} value={value} onValueChange={onValueChange}>
      {cities.map((city) => (
        <ChoiceCard
          key={city.id}
          value={city.id}
          title={city.name}
          description={city.note}
          end={
            city.level === "live" ? (
              <Badge variant="gem">
                <Footprints aria-hidden="true" />
                Live data
              </Badge>
            ) : (
              <Badge variant="estimate">Less data</Badge>
            )
          }
        />
      ))}
    </ChoiceGroup>
  );
}
