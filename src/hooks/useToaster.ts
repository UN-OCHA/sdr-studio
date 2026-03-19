import { OverlayToaster, type Toaster, type Intent, type IconName, type MaybeElement } from "@blueprintjs/core";
import { useEffect, useState, useCallback } from "react";

let toasterInstance: Toaster | null = null;

export const getToaster = async () => {
  if (toasterInstance) return toasterInstance;
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

  const showToaster = useCallback((message: string, intent: Intent = "none", icon?: IconName | MaybeElement) => {
    if (instance) {
      instance.show({ message, intent, icon });
    } else {
      console.warn("Toaster not ready yet:", message);
      getToaster().then(inst => inst.show({ message, intent, icon }));
    }
  }, [instance]);

  return { showToaster, toaster: instance };
}
