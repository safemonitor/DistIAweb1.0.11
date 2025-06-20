import { useState, useEffect } from 'react';
import { UserActivityLogViewer } from '../components/UserActivityLogViewer';

export function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Activity Logs</h1>
          <p className="mt-2 text-sm text-gray-700">
            A comprehensive audit trail of all user activities in the system.
          </p>
        </div>
      </div>

      <UserActivityLogViewer showFilters={true} showExport={true} limit={1000} />
    </div>
  );
}