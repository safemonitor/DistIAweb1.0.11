import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Receipt,
  Settings,
  Building2,
  BarChart,
  Truck,
  UserPlus,
  MapPin,
  ShoppingBag,
  CalendarDays,
  Warehouse,
  Activity,
  PackageCheck,
  ChevronDown,
  ChevronRight,
  Briefcase,
  FileText,
  Tag,
  Database,
  User,
  Shield,
  Send,
  Route as RouteIcon,
  Car,
  Bot,
  MessageSquare,
  Image,
  Megaphone
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { TenantModule } from '../types/database';

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  requiredRoles?: string[];
  requiredModules?: TenantModule['module_name'][];
  children?: NavigationItem[];
  moduleType?: string;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { 
    name: 'Presales', 
    icon: Briefcase,
    requiredModules: ['presales_delivery'],
    children: [
      { 
        name: 'Orders', 
        href: '/presales/orders', 
        icon: ClipboardList,
        moduleType: 'presales'
      },
      { 
        name: 'Agents & Vehicles', 
        href: '/presales/agents-vehicles', 
        icon: Car,
        moduleType: 'presales'
      },
      { 
        name: 'Route Planning', 
        href: '/presales/route-planning', 
        icon: RouteIcon,
        moduleType: 'presales'
      },
      { 
        name: 'Reports', 
        href: '/reports/presales', 
        icon: BarChart,
        moduleType: 'presales'
      }
    ]
  },
  { 
    name: 'Sales', 
    icon: ShoppingBag,
    requiredModules: ['van_sales'],
    children: [
      { 
        name: 'Sales', 
        href: '/sales', 
        icon: ShoppingBag,
        moduleType: 'sales'
      },
      { 
        name: 'Agents & Vehicles', 
        href: '/sales/agents-vehicles', 
        icon: Car,
        moduleType: 'sales'
      },
      { 
        name: 'Dispatch', 
        href: '/sales/dispatch', 
        icon: Send,
        moduleType: 'sales',
        requiredRoles: ['admin', 'superadmin']
      },
      { 
        name: 'Orders', 
        href: '/sales/orders', 
        icon: ClipboardList,
        moduleType: 'sales'
      },
      { 
        name: 'Invoices', 
        href: '/sales/invoices', 
        icon: Receipt,
        moduleType: 'sales'
      },
      { 
        name: 'Route Planning', 
        href: '/sales/route-planning', 
        icon: RouteIcon,
        moduleType: 'sales'
      },
      { 
        name: 'Reports', 
        href: '/reports/sales', 
        icon: BarChart,
        moduleType: 'sales'
      }
    ]
  },
  { 
    name: 'Delivery', 
    icon: Truck,
    requiredModules: ['presales_delivery'],
    children: [
      { 
        name: 'Presales Orders', 
        href: '/delivery/orders', 
        icon: ClipboardList,
        moduleType: 'delivery'
      },
      { 
        name: 'Agents & Vehicles', 
        href: '/delivery/agents-vehicles', 
        icon: Car,
        moduleType: 'delivery'
      },
      { 
        name: 'Deliveries', 
        href: '/deliveries', 
        icon: Truck,
        moduleType: 'delivery'
      },
      { 
        name: 'Route Planning', 
        href: '/delivery/route-planning', 
        icon: RouteIcon,
        moduleType: 'delivery'
      },
      { 
        name: 'Tracking', 
        href: '/track', 
        icon: MapPin,
        moduleType: 'delivery'
      },
      { 
        name: 'Reports', 
        href: '/reports/delivery', 
        icon: BarChart,
        moduleType: 'delivery'
      }
    ]
  },
  { 
    name: 'Marketing', 
    icon: Megaphone,
    children: [
      { 
        name: 'Dashboard', 
        href: '/marketing/dashboard', 
        icon: BarChart 
      },
      { 
        name: 'Campaigns', 
        href: '/marketing/campaigns', 
        icon: Megaphone 
      },
      { 
        name: 'Promotional Content', 
        href: '/marketing/content', 
        icon: Image 
      },
      { 
        name: 'WhatsApp Orders', 
        href: '/marketing/whatsapp-orders', 
        icon: MessageSquare 
      },
      { 
        name: 'Chatbot Config', 
        href: '/marketing/chatbot-config', 
        icon: Bot,
        requiredRoles: ['admin', 'superadmin']
      }
    ]
  },
  { 
    name: 'Warehouse', 
    icon: Warehouse,
    requiredModules: ['wms'],
    children: [
      { 
        name: 'Warehouse', 
        href: '/warehouse', 
        icon: Warehouse,
        moduleType: 'warehouse'
      },
      { 
        name: 'Supplier Orders', 
        href: '/supplier-orders', 
        icon: PackageCheck,
        moduleType: 'warehouse'
      },
      { 
        name: 'Reports', 
        href: '/reports/warehouse', 
        icon: BarChart,
        moduleType: 'warehouse'
      }
    ]
  },
  { 
    name: 'Assets', 
    icon: Database,
    children: [
      { name: 'Products', href: '/products', icon: Package },
      { name: 'Customers', href: '/customers', icon: Users },
      { 
        name: 'Promotions', 
        href: '/promotions', 
        icon: Tag,
        requiredRoles: ['admin', 'sales', 'superadmin']
      }
    ]
  },
  { name: 'AI Assistant', href: '/chatbot', icon: Bot },
  { 
    name: 'Management', 
    icon: Settings,
    requiredRoles: ['admin', 'superadmin'],
    children: [
      { 
        name: 'Users', 
        href: '/users-management', 
        icon: User,
        requiredRoles: ['admin', 'superadmin']
      },
      { 
        name: 'Activity Logs', 
        href: '/activity-logs', 
        icon: Activity,
        requiredRoles: ['admin', 'superadmin']
      },
      { 
        name: 'Settings', 
        href: '/settings', 
        icon: Settings,
        requiredRoles: ['admin', 'superadmin']
      }
    ]
  },
  // Superadmin-specific items
  { 
    name: 'Tenants', 
    href: '/tenants', 
    icon: Building2, 
    requiredRoles: ['admin', 'superadmin'] 
  },
  { 
    name: 'Superadmin', 
    href: '/superadmin', 
    icon: Shield, 
    requiredRoles: ['superadmin'] 
  }
];

export function Sidebar() {
  const location = useLocation();
  const { profile, enabledModules } = useAuthStore();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const hasModuleAccess = (requiredModules?: TenantModule['module_name'][]): boolean => {
    // Superadmin has access to all modules
    if (profile?.role === 'superadmin') {
      return true;
    }
    
    if (!requiredModules || requiredModules.length === 0) {
      return true; // No module requirements
    }

    // Check if any of the required modules are enabled
    return requiredModules.some(moduleName => 
      enabledModules.some(module => module.module_name === moduleName && module.enabled)
    );
  };

  const hasRoleAccess = (requiredRoles?: string[]): boolean => {
    // Superadmin has access to everything
    if (profile?.role === 'superadmin') {
      return true;
    }
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role requirements
    }

    return profile ? requiredRoles.includes(profile.role) : false;
  };

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const isMenuOpen = (name: string): boolean => {
    // Auto-open the menu if a child route is active
    if (openMenus[name] === undefined) {
      const item = navigation.find(item => item.name === name);
      if (item?.children) {
        const isChildActive = item.children.some(child => 
          child.href && location.pathname === child.href
        );
        return isChildActive;
      }
    }
    return !!openMenus[name];
  };

  const isActive = (href?: string, moduleType?: string): boolean => {
    if (!href) return false;
    
    // Exact match
    if (location.pathname === href) return true;
    
    // Check if it's a module-specific page
    if (moduleType && location.pathname.includes(`/${moduleType}/`)) {
      const basePath = href.split('/').pop();
      return location.pathname.includes(`/${moduleType}/${basePath}`);
    }
    
    return false;
  };

  const filteredNavigation = navigation.filter(item => {
    // Check role access
    if (!hasRoleAccess(item.requiredRoles)) {
      return false;
    }

    // Check module access
    if (!hasModuleAccess(item.requiredModules)) {
      return false;
    }

    // If item has children, filter them too
    if (item.children) {
      item.children = item.children.filter(child => 
        hasRoleAccess(child.requiredRoles) && hasModuleAccess(child.requiredModules)
      );
      
      // Only show parent if it has at least one visible child
      return item.children.length > 0;
    }

    return true;
  });

  return (
    <div className="flex h-full flex-col bg-gray-900">
      <div className="flex h-16 shrink-0 items-center px-6">
        <span className="text-2xl font-bold text-white">DistrIA</span>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {filteredNavigation.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isOpen = isMenuOpen(item.name);
                
                return (
                  <li key={item.name}>
                    {hasChildren ? (
                      <div>
                        <button
                          onClick={() => toggleMenu(item.name)}
                          className={`
                            group flex w-full items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold mx-2
                            ${isOpen
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }
                          `}
                        >
                          <item.icon className="h-6 w-6 shrink-0" />
                          {item.name}
                          {isOpen ? (
                            <ChevronDown className="ml-auto h-5 w-5" />
                          ) : (
                            <ChevronRight className="ml-auto h-5 w-5" />
                          )}
                        </button>
                        
                        {isOpen && (
                          <ul className="mt-1 pl-8 space-y-1">
                            {item.children.map((child) => (
                              <li key={child.name}>
                                <Link
                                  to={child.href || '#'}
                                  className={`
                                    group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium
                                    ${isActive(child.href, child.moduleType)
                                      ? 'bg-gray-700 text-white'
                                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }
                                  `}
                                >
                                  <child.icon className="h-5 w-5 shrink-0" />
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={item.href || '#'}
                        className={`
                          group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold mx-2
                          ${isActive(item.href)
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }
                        `}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto mb-4">
            <div className="px-4 py-3 bg-gray-800 mx-2 rounded-md">
              <div className="text-sm font-medium text-white">
                {profile?.first_name} {profile?.last_name}
              </div>
              <div className="text-xs text-gray-400 capitalize">
                {profile?.role}
                {profile?.role === 'superadmin' && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-900 text-red-100 rounded-sm text-xs">
                    SUPER
                  </span>
                )}
              </div>
              {enabledModules.length > 0 && profile?.role !== 'superadmin' && (
                <div className="text-xs text-gray-400 mt-1">
                  Modules: {enabledModules.map(m => m.module_name).join(', ')}
                </div>
              )}
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}