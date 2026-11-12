import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface PlaceSelectProps {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function PlaceSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: PlaceSelectProps) {
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => [...options].sort((a, b) => a.localeCompare(b)),
    [options],
  );

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="h-10 w-full justify-between rounded-xl font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No match found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === item ? "opacity-100" : "opacity-0")} />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
