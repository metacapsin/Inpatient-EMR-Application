import { useEffect, useState } from "react";

export default function usePedometer() {
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    function onDeviceReady() {
      const permissions = (window as any).cordova.plugins.permissions;

      permissions.requestPermission(
        permissions.ACTIVITY_RECOGNITION,
        (status: any) => {
          if (status.hasPermission) {
            startPedometer();
          } else {
            console.error("Permission denied");
          }
        },
        (err: any) => console.error(err)
      );
    }

    function startPedometer() {
      if (window.pedometer) {
        window.pedometer.startPedometerUpdates(
          (data: any) => {
            console.log("STEPS:", data.numberOfSteps);
            setSteps(data.numberOfSteps);
          },
          (error: any) => {
            console.error("Pedometer error:", error);
          }
        );
      }
    }

    document.addEventListener("deviceready", onDeviceReady);

    return () => {
      document.removeEventListener("deviceready", onDeviceReady);
    };
  }, []);

  return steps;
}