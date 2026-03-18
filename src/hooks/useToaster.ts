import { OverlayToaster, type Toaster } from "@blueprintjs/core";
import { useEffect, useState } from "react";

let toasterInstance: Toaster | null = null;

export const getToaster = async () => {
  if (toasterInstance) return toasterInstance;
  // Use .create() instead of .createAsync() as it's the new standard
  toasterInstance = await OverlayToaster.create({ position: "top" });
  return toasterInstance;
};

export function useToaster() {
  const [instance, setInstance] = useState<Toaster | null>(null);

  useEffect(() => {
    getToaster().then(setInstance);
  }, []);

  return instance;
}
