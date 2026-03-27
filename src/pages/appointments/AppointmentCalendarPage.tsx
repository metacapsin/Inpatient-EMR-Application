import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppointmentCalendar from './AppointmentCalendar';

const AppointmentCalendarPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <main className="w-full">
        <AppointmentCalendar
          onListView={() => navigate('/app/appointments')}
          onAddAppointment={() => navigate('/app/appointments/add')}
        />
      </main>
    </div>
  );
};

export default AppointmentCalendarPage;
