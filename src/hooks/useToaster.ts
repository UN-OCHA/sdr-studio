import { OverlayToaster, type Toaster, type Intent } from "@blueprintjs/core";
import { useEffect, useState } from "react";

let toasterInstance: Toaster | null = null;

export const getToaster = async () => {
  if (toasterInstance) return toasterInstance;
  // Use .create() instead of .createAsync() as it's the new standard
  toasterInstance = await OverlayToaster.create({ position: "top" });
  return toasterInstance;
};

export function useToaster() {
  const [instance, setInstance] = useState<Toaster | null>(toasterInstance);

  useEffect(() => {
    if (!instance) {
      getToaster().then(setInstance);
    }
  }, [instance]);

  const showToaster = (message: string, intent: Intent = "none", icon?: any) => {
    if (instance) {
      instance.show({ message, intent, icon });
    } else {
      // Fallback if toaster isn't ready, though it should be after the first effect
      console.warn("Toaster not ready yet:", message);
      // We could also queue it or try to get it again
      getToaster().then(inst => inst.show({ message, intent, icon }));
    }
  };

  return { showToaster, toaster: instance };
}
