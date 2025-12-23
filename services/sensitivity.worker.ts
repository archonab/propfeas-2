
import { calculateMatrixSync } from './sensitivityService';

self.onmessage = (e) => {
  const { settings, costs, revenues, xAxis, yAxis, stepsX, stepsY, site } = e.data;
  
  try {
      const result = calculateMatrixSync(
          settings, 
          costs, 
          revenues, 
          xAxis, 
          yAxis, 
          stepsX, 
          stepsY, 
          site
      );
      self.postMessage(result);
  } catch (err) {
      console.error("Worker Calculation Error", err);
      // Fallback or empty result in case of error
      self.postMessage([]);
  }
};
