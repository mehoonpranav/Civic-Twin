import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { citiesForState, STATE_NAMES } from "@/lib/india-places";
import { PlaceSelect } from "@/components/PlaceSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CityGate() {
  const { user, loading } = useSession();
  const { data: profile, isFetched } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  const needed = !!user && isFetched && (!profile?.state || !profile?.city);

  useEffect(() => {
    if (profile?.state) setState(profile.state);
    if (profile?.city) setCity(profile.city);
  }, [profile?.state, profile?.city]);

  const save = async () => {
    if (!user || !state || !city) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ state, city }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success(`Showing reports from ${city}.`);
  };

  if (loading || !needed) return null;

  return (
    <Dialog open>
      <DialogContent className="max-w-md rounded-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="font-display">Choose your city</DialogTitle>
          <DialogDescription>
            CivicTwin only shows reports from the city you live in. Pick a state, then a city.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <PlaceSelect
            label="State"
            value={state}
            options={STATE_NAMES}
            placeholder="Search state"
            onChange={(value) => {
              setState(value);
              setCity("");
            }}
          />
          <PlaceSelect
            label="City"
            value={city}
            options={citiesForState(state)}
            placeholder={state ? "Search city" : "Choose a state first"}
            disabled={!state}
            onChange={setCity}
          />
          <Button className="w-full rounded-full" disabled={busy || !state || !city} onClick={() => void save()}>
            Save and continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
