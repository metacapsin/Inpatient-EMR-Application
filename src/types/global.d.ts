interface PedometerData {
    numberOfSteps: number;
    startDate: string;
    endDate: string;
  }
  
  interface Pedometer {
    startPedometerUpdates(
      success: (data: PedometerData) => void,
      error: (error: any) => void
    ): void;
  }
  
  interface Window {
    pedometer?: Pedometer;
    cordova?: any;
  }