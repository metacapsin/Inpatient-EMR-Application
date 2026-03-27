import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaRunning } from 'react-icons/fa';
import usePedometer from '@/hooks/usePedometer';

const HealthSummary: React.FC = () => {
  const [loading] = useState(false);
  const steps = usePedometer();
  if (loading) {
    return (
      <div className="panel flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="panel">
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li><Link to="/app/dashboard" className="text-primary hover:underline">Dashboard</Link></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Health Summary</li>
          </ul>
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold">Step Tracker</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your daily walking activity.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="panel border border-white-light dark:border-dark">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <FaRunning className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Steps Today</h4>
            </div>
            <p className="text-3xl font-bold text-primary">{steps.toLocaleString()}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.min(Math.round((steps / 10000) * 100), 100)}% of 10,000</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min((steps / 10000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthSummary;
