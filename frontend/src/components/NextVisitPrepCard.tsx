import { useEffect, useState, useRef } from 'react';
import { aiHealthInsightsAPI } from '../services/api';
import { Pill, FlaskConical, FileText, HelpCircle, Stethoscope, Activity, ClipboardList } from 'lucide-react';

const categoryIcons: Record<string, any> = {
  'Medications': Pill,
  'Tests': FlaskConical,
  'Documents': FileText,
  'Questions': HelpCircle,
  'Symptoms': Stethoscope,
  'Lifestyle': Activity,
  'default': ClipboardList
};

const getIcon = (text: string) => {
  const key = Object.keys(categoryIcons).find(k => text.toLowerCase().includes(k.toLowerCase()));
  return categoryIcons[key || 'default'];
};

interface NextVisitPrepCardProps {
  patientId: string;
}

export default function NextVisitPrepCard({ patientId }: NextVisitPrepCardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current || !patientId) return;
    hasFetched.current = true;

    const fetchData = async () => {
      try {
        const response = await aiHealthInsightsAPI.getNextVisitPrep(patientId);
        setData(response.data.data);
      } catch (error) {
        console.error('Error fetching next visit prep:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId]);

  if (loading) return <div className="panel p-4">Loading...</div>;
  if (!data?.items || data.items.length === 0) return null;

  const groupedItems = data.items.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item.action);
    return acc;
  }, {});

  return (
    <div className="panel p-4 mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold">Next Visit Preparation</h3>
        <svg
          className="w-5 h-5 transition-transform"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isExpanded && (
        <div className="space-y-4 mt-4">
        {Object.entries(groupedItems).map(([category, actions]: [string, any]) => (
          <div key={category}>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              {(() => { const Icon = getIcon(category); return <Icon className="w-4 h-4 text-primary" />; })()}
              <span>{category}</span>
            </h4>
            <div className="space-y-1">
              {actions.map((action: string, index: number) => (
                <div key={index} className="text-sm text-gray-600 dark:text-gray-400 pl-4 flex items-start gap-2">
                   <span className="w-1.5 h-1.5 mt-2 bg-gray-500 rounded-full"></span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
