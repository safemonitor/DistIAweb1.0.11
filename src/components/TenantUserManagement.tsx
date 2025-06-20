import { useState, useEffect } from 'react';
import { User, UserPlus, UserMinus, Mail, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { UserModal } from './UserModal';
import type { Tenant, Profile } from '../types/database';

interface TenantUserManagementProps {
  tenant: Tenant;
  onRefresh: () => void;
}

export function TenantUserManagement({ tenant, onRefresh }: TenantUserManagementProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | undefined>();
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<Profile | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [tenant.id]);

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddUser = () => {
    setSelectedUser(undefined);
    setIsUserModalOpen(true);
  };

  const handleRemoveUser = (user: Profile) => {
    setUserToRemove(user);
    setIsRemoveModalOpen(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove) return;
    
    try {
      // Delete the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToRemove.id);

      if (error) throw error;
      
      // Close modal and refresh
      setIsRemoveModalOpen(false);
      setUserToRemove(null);
      await fetchUsers();
      onRefresh();
    } catch (err) {
      console.error('Error removing user:', err);
      alert('Failed to remove user');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'sales':
        return 'bg-blue-100 text-blue-800';
      case 'presales':
        return 'bg-green-100 text-green-800';
      case 'delivery':
        return 'bg-yellow-100 text-yellow-800';
      case 'warehouse':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
          <p className="text-sm text-gray-500">
            Manage users for {tenant.name} ({users.length} of {tenant.max_users} seats used)
          </p>
        </div>
        <button
          onClick={handleAddUser}
          disabled={users.length >= tenant.max_users}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {users.length >= tenant.max_users && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                This tenant has reached its maximum user limit. To add more users, increase the seat limit or remove existing users.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.length === 0 ? (
            <li className="px-6 py-4 text-center text-sm text-gray-500">
              No users found for this tenant
            </li>
          ) : (
            users.map((user) => (
              <li key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <User className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {user.id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                  <button
                    onClick={() => handleRemoveUser(user)}
                    className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                    title="Remove user"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSuccess={() => {
          fetchUsers();
          onRefresh();
          setIsUserModalOpen(false);
        }}
      />

      {/* Remove User Confirmation Modal */}
      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title="Remove User"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Are you sure you want to remove this user from the tenant? This action cannot be undone.
          </p>
          
          {userToRemove && (
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {userToRemove.first_name} {userToRemove.last_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    Role: {userToRemove.role}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={confirmRemoveUser}
              className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setIsRemoveModalOpen(false)}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}