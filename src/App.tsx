
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CreditCard,
  Wallet,
  BarChart3,
  Bell,
  Search,
  Plus,
  Moon,
  Sun,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  Download,
  LogIn,
  LogOut,
  CircleUserRound,
  Trash2,
  RefreshCw,
  Eye,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Monitor,
} from 'lucide-react';
import './App.css';

const API = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
).replace(/\/$/, '');

type Customer = {
  id: number;
  name: string;
  email: string;
  phone?: string;
};

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  customerId?: number;
  customer?: Customer;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount?: number;
  status: string;
};

type Payment = {
  id: number;
  invoiceId?: number;
  invoice?: Invoice;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  referenceNumber?: string;
};

type AuthProfile = {
  authenticated: boolean;
  name?: string;
  email?: string;
  picture?: string;
  admin?: boolean;
};

type SessionUser = {
  name?: string;
  email?: string;
};

type UserSession = {
  id: number;
  user?: SessionUser;
  loginAt?: string;
  lastActivityAt?: string;
  logoutAt?: string;
  ipAddress?: string;
  userAgent?: string;
  active?: boolean;
};

type Page =
  | 'Dashboard'
  | 'Customers'
  | 'Products'
  | 'Invoices'
  | 'Payments'
  | 'Dues'
  | 'Reports'
  | 'Admin';

type Modal =
  | 'customer'
  | 'product'
  | 'invoice'
  | 'payment'
  | 'account'
  | 'logout'
  | 'customerDetails'
  | null;

const navItems = [
  { label: 'Dashboard' as Page, icon: LayoutDashboard },
  { label: 'Customers' as Page, icon: Users },
  { label: 'Products' as Page, icon: Package },
  { label: 'Invoices' as Page, icon: FileText },
  { label: 'Payments' as Page, icon: CreditCard },
  { label: 'Dues' as Page, icon: Wallet },
  { label: 'Reports' as Page, icon: BarChart3 },
];

const descriptions: Record<Page, string> = {
  Dashboard: 'Here’s what’s happening with your business today.',
  Customers: 'Manage your customer directory.',
  Products: 'Manage your products, pricing and stock.',
  Invoices: 'Create and track your saved invoices.',
  Payments: 'Review payments and customer balances.',
  Dues: 'Track outstanding and overdue balances.',
  Reports: 'Your financial overview, based on saved records.',
  Admin: 'Monitor recorded user sessions and device details.',
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateLabel = (date?: string) => {
  if (!date) return '—';

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const outstanding = (invoice: Invoice) =>
  Math.max(
    0,
    Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0),
  );

const invoiceStatus = (invoice: Invoice) => {
  if (outstanding(invoice) <= 0) return 'Paid';
  if (Number(invoice.paidAmount || 0) > 0) return 'Partial';

  if (
    invoice.dueDate &&
    invoice.dueDate < new Date().toISOString().slice(0, 10)
  ) {
    return 'Overdue';
  }

  return 'Pending';
};

function getDeviceBrowser(userAgent?: string) {
  if (!userAgent) {
    return {
      device: 'Unknown device',
      browser: 'Unknown browser',
    };
  }

  const ua = userAgent.toLowerCase();

  let browser = 'Other browser';

  if (ua.includes('edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome/')) {
    browser = 'Google Chrome';
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    browser = 'Safari';
  }

  let device = 'Computer';

  if (/ipad/.test(ua)) {
    device = 'iPad';
  } else if (/iphone|ipod/.test(ua)) {
    device = 'iPhone';
  } else if (/android/.test(ua)) {
    device = 'Android device';
  } else if (/windows/.test(ua)) {
    device = 'Windows PC';
  } else if (/macintosh|mac os/.test(ua)) {
    device = 'Mac';
  } else if (/linux/.test(ua)) {
    device = 'Linux computer';
  }

  return { device, browser };
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('You are not signed in. Please sign in with Google.');
  }

  if (response.status === 403) {
    throw new Error('You do not have permission to access this resource.');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function App() {
  const [dark, setDark] = useState(true);
  const [active, setActive] = useState<Page>('Dashboard');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [dashboard, setDashboard] =
    useState<Record<string, number> | null>(null);

  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    setError('');

    try {
      const [
        customerData,
        productData,
        invoiceData,
        paymentData,
      ] = await Promise.all([
        apiRequest<Customer[]>('/api/customers'),
        apiRequest<Product[]>('/api/products'),
        apiRequest<Invoice[]>('/api/invoices'),
        apiRequest<Payment[]>('/api/payments'),
      ]);

      setCustomers(customerData);
      setProducts(productData);
      setInvoices(invoiceData);
      setPayments(paymentData);

      try {
        const summary =
          await apiRequest<Record<string, number>>(
            '/api/dashboard/summary',
          );

        setDashboard(summary);
      } catch {
        setDashboard(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const clearWorkspace = useCallback(() => {
    setCustomers([]);
    setProducts([]);
    setInvoices([]);
    setPayments([]);
    setDashboard(null);
    setSessions([]);
    setActive('Dashboard');
    setError('');
    setSearch('');
    setFilter('All');
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError('');

    try {
      const result =
        await apiRequest<UserSession[]>('/api/admin/sessions');

      setSessions(result);
    } catch (err) {
      setSessionsError(
        err instanceof Error
          ? err.message
          : 'Could not load user sessions.',
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Verify the login session before loading private workspace data.
  useEffect(() => {
    let cancelled = false;

    async function checkLogin() {
      try {
        const user = await apiRequest<AuthProfile>('/api/auth/me');

        if (cancelled) return;

        if (user.authenticated) {
          setProfile(user);
          await loadData();
        } else {
          setProfile(null);
          clearWorkspace();
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          clearWorkspace();
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    }

    void checkLogin();

    return () => {
      cancelled = true;
    };
  }, [loadData, clearWorkspace]);

  // Fetch sessions only when the administrator opens Devices.
  useEffect(() => {
    if (active === 'Admin' && profile?.admin) {
      void loadSessions();
    }
  }, [active, profile?.admin, loadSessions]);

  const totalInvoiced = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.totalAmount || 0),
    0,
  );

  const totalCollected = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.paidAmount || 0),
    0,
  );

  const totalDue = invoices.reduce(
    (sum, invoice) => sum + outstanding(invoice),
    0,
  );

  const overdueAmount = invoices
    .filter(invoice => invoiceStatus(invoice) === 'Overdue')
    .reduce((sum, invoice) => sum + outstanding(invoice), 0);

  const visibleInvoices = useMemo(
    () =>
      invoices.filter(invoice => {
        const customer =
          invoice.customer?.name ||
          customers.find(c => c.id === invoice.customerId)?.name ||
          '';

        const matchesSearch =
          `${invoice.invoiceNumber} ${customer}`
            .toLowerCase()
            .includes(search.toLowerCase());

        const status = invoiceStatus(invoice);
        const matchesFilter = filter === 'All' || status === filter;

        return (
          matchesSearch &&
          matchesFilter &&
          (active !== 'Dues' || outstanding(invoice) > 0)
        );
      }),
    [invoices, customers, search, filter, active],
  );

  const visibleCustomers = customers.filter(customer =>
    `${customer.name} ${customer.email} ${customer.phone || ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const visibleProducts = products.filter(product =>
    `${product.name} ${product.description || ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  function goToPage(page: Page) {
    if (page === 'Admin' && !profile?.admin) {
      notify('Administrator access is required.');
      return;
    }

    setActive(page);
    setSearch('');
    setFilter('All');
    setMobileMenu(false);
  }

  function customerName(invoice: Invoice) {
    return (
      invoice.customer?.name ||
      customers.find(c => c.id === invoice.customerId)?.name ||
      (invoice.customerId
        ? `Customer #${invoice.customerId}`
        : 'Unknown customer')
    );
  }

  async function submitForm(
    event: FormEvent<HTMLFormElement>,
    kind: 'customer' | 'product' | 'invoice' | 'payment',
  ) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    setBusy(true);
    setError('');

    try {
      if (kind === 'customer') {
        const data = {
          name: String(form.get('name') || '').trim(),
          email: String(form.get('email') || '').trim(),
          phone: String(form.get('phone') || '').trim(),
        };

        await apiRequest<Customer>('/api/customers', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        notify('Customer saved successfully.');
      }

      if (kind === 'product') {
        const data = {
          name: String(form.get('name') || '').trim(),
          description: String(form.get('description') || '').trim(),
          price: Number(form.get('price')),
          stockQuantity: Number(form.get('stockQuantity') || 0),
        };

        if (data.price < 0 || data.stockQuantity < 0) {
          throw new Error('Price and stock cannot be negative.');
        }

        await apiRequest<Product>('/api/products', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        notify('Product saved successfully.');
      }

      if (kind === 'invoice') {
        const customerId = Number(form.get('customerId'));
        const amount = Number(form.get('totalAmount'));
        const dueDate = String(form.get('dueDate') || '');

        if (!customerId || amount <= 0 || !dueDate) {
          throw new Error(
            'Choose a customer, a valid amount and a due date.',
          );
        }

        const invoiceNumber =
          String(form.get('invoiceNumber') || '').trim() ||
          `INV-${Date.now()}`;

        await apiRequest<Invoice>('/api/invoices', {
          method: 'POST',
          body: JSON.stringify({
            invoiceNumber,
            customerId,
            invoiceDate: today,
            dueDate,
            totalAmount: amount,
          }),
        });

        notify('Invoice saved to your database.');
      }

      if (kind === 'payment') {
        const invoiceId = Number(form.get('invoiceId'));
        const amount = Number(form.get('amount'));
        const invoice = invoices.find(i => i.id === invoiceId);

        if (!invoice) {
          throw new Error('Select a valid invoice.');
        }

        if (amount <= 0 || amount > outstanding(invoice)) {
          throw new Error(
            `Enter a payment up to ${money(outstanding(invoice))}.`,
          );
        }

        await apiRequest<Payment>('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            invoiceId,
            amount,
            paymentDate: String(form.get('paymentDate') || today),
            paymentMethod: String(form.get('paymentMethod') || 'Cash'),
            referenceNumber: String(form.get('referenceNumber') || ''),
          }),
        });

        notify('Payment saved and invoice balance updated.');
      }

      setModal(null);
      await loadData(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save data.';

      setError(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;

    setBusy(true);

    try {
      await apiRequest<void>(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      setProducts(previous =>
        previous.filter(p => p.id !== product.id),
      );

      notify('Product deleted.');
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : 'Could not delete product.',
      );
    } finally {
      setBusy(false);
    }
  }

  function exportInvoices() {
    const rows = [
      [
        'Invoice',
        'Customer',
        'Date',
        'Due date',
        'Amount',
        'Paid',
        'Outstanding',
        'Status',
      ],
      ...visibleInvoices.map(invoice => [
        invoice.invoiceNumber,
        customerName(invoice),
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.totalAmount,
        invoice.paidAmount,
        outstanding(invoice),
        invoiceStatus(invoice),
      ]),
    ];

    const csv = rows
      .map(row =>
        row
          .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );

    const link = document.createElement('a');
    link.href = url;
    link.download = `buzzflow-${active.toLowerCase()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    notify('CSV exported.');
  }

  function openGoogleLogin() {
    window.location.href = `${API}/oauth2/authorization/google`;
  }

  async function logout() {
    setBusy(true);

    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout could not be completed.');
      }

      setModal(null);
      setProfile(null);
      clearWorkspace();

      notify('You have been signed out.');
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : 'Logout failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  function openCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setModal('customerDetails');
  }

  const selectedCustomerInvoices = selectedCustomer
    ? invoices.filter(
        invoice =>
          invoice.customerId === selectedCustomer.id ||
          invoice.customer?.id === selectedCustomer.id,
      )
    : [];

  const selectedCustomerPayments = payments.filter(payment =>
    selectedCustomerInvoices.some(
      invoice =>
        invoice.id === (payment.invoiceId ?? payment.invoice?.id),
    ),
  );

  const selectedCustomerDue = selectedCustomerInvoices.reduce(
    (sum, invoice) => sum + outstanding(invoice),
    0,
  );

  // Initial authentication check.
  if (!authChecked) {
    return (
      <div className={dark ? 'app dark' : 'app light'}>
        <main className="main-content">
          <section className="panel loading-panel">
            <RefreshCw className="spin" size={24} />
            <h3>Checking your login…</h3>
            <p className="muted">Connecting securely to BuzzFlow.</p>
          </section>
        </main>
      </div>
    );
  }

  // IMPORTANT: Never render the dashboard when signed out.
  if (!profile?.authenticated) {
    return (
      <div className={dark ? 'app dark login-page' : 'app light login-page'}>
        <main className="login-container">
          <section className="login-card">
            <div className="brand login-brand">
              <span className="brand-icon">B</span>
              <span>
                Buzz<span className="brand-accent">Flow</span>
                <small>FINANCE WORKSPACE</small>
              </span>
            </div>

            <div className="login-symbol">
              <ShieldCheck size={32} />
            </div>

            <h1>Welcome to BuzzFlow</h1>
            <p className="muted">
              Sign in securely to manage your customers, invoices,
              payments and outstanding dues.
            </p>

            <button
              className="google-button"
              onClick={openGoogleLogin}
            >
              <LogIn size={19} />
              Continue with Google
              <ChevronRight size={18} />
            </button>

            <p className="login-footnote">
              Secure Google sign-in · Your business records stay in your workspace
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={dark ? 'app dark' : 'app light'}>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => goToPage('Dashboard')}
        >
          <span className="brand-icon">B</span>
          <span>
            Buzz<span className="brand-accent">Flow</span>
            <small>FINANCE WORKSPACE</small>
          </span>
        </button>

        <button
          className="mobile-toggle icon-button"
          onClick={() => setMobileMenu(!mobileMenu)}
          aria-label="Toggle menu"
        >
          {mobileMenu ? <X /> : <Menu />}
        </button>

        <nav className={mobileMenu ? 'navigation open' : 'navigation'}>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={active === label ? 'nav-link active' : 'nav-link'}
              onClick={() => goToPage(label)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}

          {profile.admin && (
            <button
              className={active === 'Admin' ? 'nav-link active' : 'nav-link'}
              onClick={() => goToPage('Admin')}
            >
              <Monitor size={16} /> Devices
            </button>
          )}
        </nav>

        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() => notify('You are all caught up.')}
          >
            <Bell size={19} />
          </button>

          <button
            className="icon-button"
            aria-label="Refresh data"
            onClick={() => {
              if (profile) void loadData();
              if (active === 'Admin' && profile.admin) {
                void loadSessions();
              }
            }}
          >
            <RefreshCw size={18} />
          </button>

          <button
            className="icon-button"
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          <button
            className="profile"
            aria-label="Account options"
            onClick={() => setModal('account')}
            title={profile.email || 'Account'}
          >
            {profile.picture ? (
              <img
                src={profile.picture}
                alt="Google profile"
                className="profile-picture"
              />
            ) : (
              <CircleUserRound size={20} />
            )}
            <span className="login-indicator signed-in" />
          </button>
        </div>
      </header>

      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} /> {notice}
          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <main className="main-content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).toUpperCase()}
            </p>
            <h1>
              {active === 'Dashboard'
                ? `Good evening${profile.name ? `, ${profile.name.split(' ')[0]}` : ''} 👋`
                : active === 'Admin'
                  ? 'Devices'
                  : active}
            </h1>
            <p className="muted">{descriptions[active]}</p>
          </div>

          <div className="welcome-actions">
            <button className="secondary-button" onClick={exportInvoices}>
              <Download size={16} /> Export
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                void loadData();
                if (active === 'Admin' && profile.admin) {
                  void loadSessions();
                }
              }}
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              className="primary-button"
              onClick={() => setModal('invoice')}
            >
              <Plus size={17} /> Create invoice
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => void loadData()}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <section className="panel loading-panel">
            <RefreshCw className="spin" size={24} />
            <h3>Loading your workspace…</h3>
            <p className="muted">Connecting to your saved records.</p>
          </section>
        ) : (
          <>
            {(active === 'Dashboard' || active === 'Reports') && (
              <>
                <section className="metrics">
                  <Metric
                    title="Total invoiced"
                    value={money(dashboard?.totalAmount ?? totalInvoiced)}
                    change={`${invoices.length} invoices`}
                    icon={<FileText />}
                    trend="up"
                  />
                  <Metric
                    title="Collected"
                    value={money(dashboard?.paidAmount ?? totalCollected)}
                    change={`${totalInvoiced ? Math.round((totalCollected / totalInvoiced) * 100) : 0}% collected`}
                    icon={<TrendingUp />}
                    trend="up"
                  />
                  <Metric
                    title="Outstanding"
                    value={money(dashboard?.outstandingAmount ?? totalDue)}
                    change="Unpaid balance"
                    icon={<Wallet />}
                    trend="down"
                  />
                  <Metric
                    title="Overdue amount"
                    value={money(overdueAmount)}
                    change="Review overdue"
                    icon={<AlertCircle />}
                    trend="down"
                  />
                </section>

                {active === 'Dashboard' && (
                  <section className="content-grid">
                    <div className="panel chart-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Financial overview</h2>
                          <p className="muted">
                            Based on saved invoice records
                          </p>
                        </div>
                        <CalendarDays size={19} />
                      </div>

                      <div className="chart-legend">
                        <span><i className="legend-pink" /> Invoiced</span>
                        <span><i className="legend-muted" /> Collected</span>
                      </div>

                      <div className="chart">
                        {[
                          { label: 'Invoiced', value: totalInvoiced },
                          { label: 'Collected', value: totalCollected },
                          { label: 'Outstanding', value: totalDue },
                        ].map(item => (
                          <div className="bar-group" key={item.label}>
                            <div className="bar-pair">
                              <div
                                className="bar bar-pink"
                                style={{
                                  height: `${Math.max(
                                    4,
                                    totalInvoiced
                                      ? (item.value / totalInvoiced) * 100
                                      : 4,
                                  )}%`,
                                }}
                              />
                            </div>
                            <span>{item.label}</span>
                            <strong>{money(item.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="panel collection-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Collection progress</h2>
                          <p className="muted">Payments recorded so far</p>
                        </div>
                      </div>

                      <div className="donut-wrap">
                        <div
                          className="donut"
                          style={{
                            '--progress': `${totalInvoiced ? (totalCollected / totalInvoiced) * 100 : 0}%`,
                          } as React.CSSProperties}
                        >
                          <div>
                            <strong>
                              {totalInvoiced
                                ? Math.round((totalCollected / totalInvoiced) * 100)
                                : 0}%
                            </strong>
                            <span>collected</span>
                          </div>
                        </div>
                      </div>

                      <div className="collection-row">
                        <span>Collected</span>
                        <strong>{money(totalCollected)}</strong>
                      </div>
                      <div className="collection-row">
                        <span>Remaining</span>
                        <strong>{money(totalDue)}</strong>
                      </div>
                      <div className="collection-row">
                        <span>Customers</span>
                        <strong>{customers.length}</strong>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}

            {active === 'Customers' && (
              <section className="panel invoices-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Customer directory</h2>
                    <p className="muted">
                      Select a customer to inspect invoices and dues.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setModal('customer')}
                  >
                    <Plus size={16} /> Add customer
                  </button>
                </div>

                <SearchTools
                  search={search}
                  setSearch={setSearch}
                  placeholder="Search customers…"
                />

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>CUSTOMER</th>
                        <th>EMAIL</th>
                        <th>PHONE</th>
                        <th>INVOICES</th>
                        <th>OUTSTANDING</th>
                        <th>DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCustomers.map(customer => {
                        const list = invoices.filter(
                          invoice =>
                            invoice.customerId === customer.id ||
                            invoice.customer?.id === customer.id,
                        );

                        return (
                          <tr key={customer.id}>
                            <td><strong>{customer.name}</strong></td>
                            <td>{customer.email}</td>
                            <td>{customer.phone || '—'}</td>
                            <td>{list.length}</td>
                            <td className="due-value">
                              {money(list.reduce((sum, i) => sum + outstanding(i), 0))}
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => openCustomer(customer)}
                              >
                                <Eye size={15} /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!visibleCustomers.length && (
                        <EmptyRow
                          columns={6}
                          text="No customers found. Add your first customer."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {active === 'Products' && (
              <section className="panel invoices-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Product catalogue</h2>
                    <p className="muted">
                      Products are stored in your database.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setModal('product')}
                  >
                    <Plus size={16} /> Add product
                  </button>
                </div>

                <SearchTools
                  search={search}
                  setSearch={setSearch}
                  placeholder="Search products…"
                />

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PRODUCT</th>
                        <th>DESCRIPTION</th>
                        <th>PRICE</th>
                        <th>STOCK</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map(product => (
                        <tr key={product.id}>
                          <td><strong>{product.name}</strong></td>
                          <td>{product.description || '—'}</td>
                          <td>{money(product.price)}</td>
                          <td>{product.stockQuantity}</td>
                          <td>
                            <button
                              className="text-button danger-text"
                              disabled={busy}
                              onClick={() => void deleteProduct(product)}
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!visibleProducts.length && (
                        <EmptyRow
                          columns={5}
                          text="No products yet. Add a product to get started."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(active === 'Invoices' ||
              active === 'Dues' ||
              active === 'Dashboard') && (
              <section className="panel invoices-panel">
                <div className="panel-heading invoices-heading">
                  <div>
                    <h2>
                      {active === 'Dues'
                        ? 'Outstanding dues'
                        : active === 'Dashboard'
                          ? 'Recent invoices'
                          : 'All invoices'}
                    </h2>
                    <p className="muted">
                      {active === 'Dues'
                        ? 'Only invoices with outstanding balances.'
                        : 'Live records loaded from your database.'}
                    </p>
                  </div>
                  {active === 'Dashboard' && (
                    <button
                      className="text-button"
                      onClick={() => goToPage('Invoices')}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>

                <SearchTools
                  search={search}
                  setSearch={setSearch}
                  placeholder="Search invoices or customers…"
                >
                  <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    aria-label="Filter status"
                  >
                    {['All', 'Paid', 'Pending', 'Partial', 'Overdue'].map(value => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </SearchTools>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>INVOICE</th>
                        <th>CUSTOMER</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>PAID</th>
                        <th>STATUS</th>
                        <th>DUE</th>
                        <th>PAY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(active === 'Dashboard'
                        ? visibleInvoices.slice(0, 5)
                        : visibleInvoices
                      ).map(invoice => (
                        <tr key={invoice.id}>
                          <td className="invoice-id">{invoice.invoiceNumber}</td>
                          <td>{customerName(invoice)}</td>
                          <td>{dateLabel(invoice.invoiceDate)}</td>
                          <td>{money(invoice.totalAmount)}</td>
                          <td>{money(invoice.paidAmount)}</td>
                          <td>
                            <span className={`status status-${invoiceStatus(invoice).toLowerCase()}`}>
                              {invoiceStatus(invoice)}
                            </span>
                          </td>
                          <td className="due-value">{money(outstanding(invoice))}</td>
                          <td>
                            {outstanding(invoice) > 0 && (
                              <button
                                className="text-button"
                                onClick={() => setModal('payment')}
                              >
                                <Plus size={14} /> Record
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!visibleInvoices.length && (
                        <EmptyRow
                          columns={8}
                          text="No matching invoices. Create an invoice for a saved customer."
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  <span>{visibleInvoices.length} matching invoices</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch('');
                      setFilter('All');
                    }}
                  >
                    Clear filters <X size={14} />
                  </button>
                </div>
              </section>
            )}

            {active === 'Payments' && (
              <section className="panel invoices-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Customer payments</h2>
                    <p className="muted">
                      Click a customer to see their payment history and balances.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setModal('payment')}
                  >
                    <Plus size={16} /> Record payment
                  </button>
                </div>

                <SearchTools
                  search={search}
                  setSearch={setSearch}
                  placeholder="Search customers…"
                />

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>CUSTOMER</th>
                        <th>INVOICES</th>
                        <th>BILLED</th>
                        <th>PAID</th>
                        <th>OUTSTANDING</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers
                        .filter(customer =>
                          customer.name.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map(customer => {
                          const list = invoices.filter(
                            invoice =>
                              invoice.customerId === customer.id ||
                              invoice.customer?.id === customer.id,
                          );

                          const billed = list.reduce(
                            (sum, invoice) => sum + Number(invoice.totalAmount || 0),
                            0,
                          );

                          const paid = list.reduce(
                            (sum, invoice) => sum + Number(invoice.paidAmount || 0),
                            0,
                          );

                          return (
                            <tr
                              key={customer.id}
                              className="clickable-row"
                              onClick={() => openCustomer(customer)}
                            >
                              <td>
                                <strong>{customer.name}</strong>
                                <p className="muted">{customer.email}</p>
                              </td>
                              <td>{list.length}</td>
                              <td>{money(billed)}</td>
                              <td>{money(paid)}</td>
                              <td className="due-value">{money(billed - paid)}</td>
                              <td>
                                <span
                                  className={`status ${billed === 0 ? 'status-pending' : billed <= paid ? 'status-paid' : paid > 0 ? 'status-partial' : 'status-pending'}`}
                                >
                                  {billed === 0
                                    ? 'No invoices'
                                    : billed <= paid
                                      ? 'Paid'
                                      : paid > 0
                                        ? 'Partial'
                                        : 'Unpaid'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      {!customers.length && (
                        <EmptyRow
                          columns={6}
                          text="Add customers and invoices to see payment details."
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="panel-heading payment-history-heading">
                  <div>
                    <h2>Recent payment records</h2>
                    <p className="muted">
                      Individual transactions from the database.
                    </p>
                  </div>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CUSTOMER</th>
                        <th>INVOICE</th>
                        <th>AMOUNT</th>
                        <th>METHOD</th>
                        <th>REFERENCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...payments]
                        .sort((a, b) =>
                          b.paymentDate.localeCompare(a.paymentDate),
                        )
                        .map(payment => {
                          const invoice =
                            invoices.find(
                              item =>
                                item.id ===
                                (payment.invoiceId ?? payment.invoice?.id),
                            ) || payment.invoice;

                          return (
                            <tr key={payment.id}>
                              <td>{dateLabel(payment.paymentDate)}</td>
                              <td>{invoice ? customerName(invoice) : '—'}</td>
                              <td>{invoice?.invoiceNumber || '—'}</td>
                              <td>{money(payment.amount)}</td>
                              <td>{payment.paymentMethod || '—'}</td>
                              <td>{payment.referenceNumber || '—'}</td>
                            </tr>
                          );
                        })}
                      {!payments.length && (
                        <EmptyRow
                          columns={6}
                          text="No payment transactions recorded yet."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {active === 'Admin' && profile.admin && (
              <section className="panel invoices-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Devices &amp; Sessions</h2>
                    <p className="muted">
                      Browsers and devices that have signed in to BuzzFlow.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => void loadSessions()}
                    disabled={sessionsLoading}
                  >
                    <RefreshCw size={16} /> Refresh sessions
                  </button>
                </div>

                <section className="metrics">
                  <Metric
                    title="Active sessions"
                    value={String(sessions.filter(session => session.active !== false).length)}
                    change="Marked active by backend"
                    icon={<Users />}
                    trend="up"
                  />
                  <Metric
                    title="Recorded sessions"
                    value={String(sessions.length)}
                    change="Sessions saved by BuzzFlow"
                    icon={<Monitor />}
                    trend="up"
                  />
                </section>

                {sessionsError && (
                  <div className="error-banner" role="alert">
                    <AlertCircle size={18} />
                    <span>{sessionsError}</span>
                    <button onClick={() => void loadSessions()}>
                      <RefreshCw size={15} /> Retry
                    </button>
                  </div>
                )}

                {sessionsLoading ? (
                  <div className="loading-panel">
                    <RefreshCw className="spin" size={22} />
                    <p className="muted">Loading recorded sessions…</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>USER</th>
                          <th>DEVICE / BROWSER</th>
                          <th>LOGIN TIME</th>
                          <th>LAST ACTIVITY</th>
                          <th>IP ADDRESS</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(session => {
                          const { device, browser } =
                            getDeviceBrowser(session.userAgent);

                          return (
                            <tr key={session.id}>
                              <td>
                                <strong>{session.user?.name || 'Unknown user'}</strong>
                                <p className="muted">
                                  {session.user?.email || 'No email'}
                                </p>
                              </td>
                              <td>
                                <div className="device-info">
                                  <Monitor size={19} />
                                  <div>
                                    <strong>{device}</strong>
                                    <small>{browser}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {session.loginAt
                                  ? new Date(session.loginAt).toLocaleString()
                                  : '—'}
                              </td>
                              <td>
                                {session.lastActivityAt
                                  ? new Date(session.lastActivityAt).toLocaleString()
                                  : '—'}
                              </td>
                              <td>{session.ipAddress || '—'}</td>
                              <td>
                                <span
                                  className={`status ${session.active === false ? 'status-overdue' : 'status-paid'}`}
                                >
                                  {session.active === false ? 'Inactive' : 'Active'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {!sessions.length && (
                          <EmptyRow
                            columns={6}
                            text="No recorded sessions were returned by the backend."
                          />
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="muted admin-note">
                  This page shows sessions recorded by BuzzFlow, not every
                  device signed in to a Google account. Device and browser
                  labels are inferred from the browser user-agent string.
                  A session can remain marked active until the backend records
                  its logout or otherwise marks it inactive.
                </p>
              </section>
            )}
          </>
        )}

        <footer className="footer">
          <span>© 2026 BuzzFlow Finance</span>
          <span>
            <i className="online-dot" />
            {error
              ? 'Connection needs attention'
              : 'Workspace ready'}
          </span>
        </footer>
      </main>

      {modal && (
        <div
          className="modal-backdrop custom-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !busy) {
              setModal(null);
            }
          }}
        >
          {modal === 'account' && (
            <div
              className="custom-modal account-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-title"
            >
              <button
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>

              <div className="account-avatar">
                {profile.picture ? (
                  <img
                    src={profile.picture}
                    alt="Google profile"
                    className="account-picture"
                  />
                ) : (
                  <CircleUserRound size={36} />
                )}
              </div>

              <h2 id="account-title">Your account</h2>
              <p className="account-name">{profile.name || 'Google user'}</p>
              <p className="muted">{profile.email || 'Email unavailable'}</p>

              <div className="account-status">
                <ShieldCheck size={18} />
                <div>
                  <strong>Signed in</strong>
                  <small>Your Google account is connected to BuzzFlow.</small>
                </div>
              </div>

              {profile.admin && (
                <p className="admin-label">Administrator access</p>
              )}

              <button
                className="logout-button"
                onClick={() => setModal('logout')}
              >
                <LogOut size={17} /> Sign out
              </button>

              <p className="modal-footnote">
                Your profile information comes from the backend Google login session.
              </p>
            </div>
          )}

          {modal === 'logout' && (
            <div
              className="custom-modal confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-title"
            >
              <button
                className="modal-close"
                onClick={() => setModal('account')}
                aria-label="Back"
              >
                <X size={19} />
              </button>

              <div className="confirm-icon"><LogOut size={27} /></div>
              <h2 id="logout-title">Sign out of BuzzFlow?</h2>
              <p className="muted">
                Your saved customers, products, invoices and payments remain
                in the database. You may need to sign in again to access them.
              </p>

              <div className="custom-modal-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setModal('account')}
                >
                  Cancel
                </button>
                <button
                  className="logout-button"
                  disabled={busy}
                  onClick={() => void logout()}
                >
                  {busy
                    ? <RefreshCw className="spin" size={16} />
                    : <LogOut size={16} />}
                  Yes, sign out
                </button>
              </div>
            </div>
          )}

          {modal === 'customerDetails' && selectedCustomer && (
            <div
              className="custom-modal details-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-detail-title"
            >
              <button
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>

              <div className="details-heading">
                <div className="details-avatar">
                  {selectedCustomer.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 id="customer-detail-title">{selectedCustomer.name}</h2>
                  <p className="muted">{selectedCustomer.email}</p>
                </div>
              </div>

              <div className="detail-stats">
                <div>
                  <span>Total billed</span>
                  <strong>
                    {money(selectedCustomerInvoices.reduce(
                      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
                      0,
                    ))}
                  </strong>
                </div>
                <div>
                  <span>Total paid</span>
                  <strong>
                    {money(selectedCustomerInvoices.reduce(
                      (sum, invoice) => sum + Number(invoice.paidAmount || 0),
                      0,
                    ))}
                  </strong>
                </div>
                <div>
                  <span>Outstanding</span>
                  <strong className="due-value">{money(selectedCustomerDue)}</strong>
                </div>
              </div>

              <h3>Invoices</h3>
              <div className="detail-list">
                {selectedCustomerInvoices.map(invoice => (
                  <div className="detail-list-row" key={invoice.id}>
                    <div>
                      <strong>{invoice.invoiceNumber}</strong>
                      <small>Due {dateLabel(invoice.dueDate)}</small>
                    </div>
                    <div>
                      <strong>{money(invoice.totalAmount)}</strong>
                      <small>{money(outstanding(invoice))} due</small>
                    </div>
                    <span className={`status status-${invoiceStatus(invoice).toLowerCase()}`}>
                      {invoiceStatus(invoice)}
                    </span>
                  </div>
                ))}
                {!selectedCustomerInvoices.length && (
                  <p className="muted">No invoices for this customer yet.</p>
                )}
              </div>

              <h3>Payment history</h3>
              <div className="detail-list">
                {selectedCustomerPayments.map(payment => (
                  <div className="detail-list-row" key={payment.id}>
                    <div>
                      <strong>{money(payment.amount)}</strong>
                      <small>{dateLabel(payment.paymentDate)}</small>
                    </div>
                    <div>
                      <strong>{payment.paymentMethod || 'Payment'}</strong>
                      <small>{payment.referenceNumber || 'No reference'}</small>
                    </div>
                  </div>
                ))}
                {!selectedCustomerPayments.length && (
                  <p className="muted">No payments recorded for this customer.</p>
                )}
              </div>

              <div className="custom-modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Close
                </button>
                {selectedCustomerDue > 0 && (
                  <button
                    className="primary-button"
                    onClick={() => setModal('payment')}
                  >
                    <Plus size={16} /> Record payment
                  </button>
                )}
              </div>
            </div>
          )}

          {(modal === 'customer' ||
            modal === 'product' ||
            modal === 'invoice' ||
            modal === 'payment') && (
            <form
              className="custom-modal form-modal"
              onSubmit={event => void submitForm(event, modal)}
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>

              <div className="form-modal-icon">
                {modal === 'customer'
                  ? <Users />
                  : modal === 'product'
                    ? <Package />
                    : modal === 'invoice'
                      ? <FileText />
                      : <CreditCard />}
              </div>

              <h2>
                {modal === 'customer'
                  ? 'Add customer'
                  : modal === 'product'
                    ? 'Add product'
                    : modal === 'invoice'
                      ? 'Create invoice'
                      : 'Record payment'}
              </h2>

              <p className="muted">
                {modal === 'customer'
                  ? 'Add a customer to your directory.'
                  : modal === 'product'
                    ? 'Save a product to your catalogue.'
                    : modal === 'invoice'
                      ? 'Choose a saved customer and enter invoice details.'
                      : 'Record a payment against an outstanding invoice.'}
              </p>

              {modal === 'customer' && (
                <>
                  <Field label="Customer name">
                    <input
                      className="form-input"
                      name="name"
                      required
                      maxLength={100}
                      placeholder="e.g. Acme Technologies"
                    />
                  </Field>
                  <Field label="Email address">
                    <input
                      className="form-input"
                      name="email"
                      required
                      type="email"
                      maxLength={150}
                      placeholder="billing@example.com"
                    />
                  </Field>
                  <Field label="Phone number">
                    <input
                      className="form-input"
                      name="phone"
                      type="tel"
                      maxLength={20}
                      placeholder="Optional"
                    />
                  </Field>
                </>
              )}

              {modal === 'product' && (
                <>
                  <Field label="Product name">
                    <input
                      className="form-input"
                      name="name"
                      required
                      maxLength={150}
                      placeholder="e.g. Website design"
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      className="form-input"
                      name="description"
                      maxLength={1000}
                      placeholder="Product details (optional)"
                    />
                  </Field>
                  <div className="form-two-columns">
                    <Field label="Price (₹)">
                      <input
                        className="form-input"
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        placeholder="1500"
                      />
                    </Field>
                    <Field label="Stock quantity">
                      <input
                        className="form-input"
                        name="stockQuantity"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue="0"
                        required
                      />
                    </Field>
                  </div>
                </>
              )}

              {modal === 'invoice' && (
                <>
                  {customers.length === 0 ? (
                    <div className="inline-warning">
                      <AlertCircle size={18} />
                      Add a customer before creating an invoice.
                    </div>
                  ) : (
                    <>
                      <Field label="Customer">
                        <select
                          className="form-input"
                          name="customerId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>Select a customer</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name} — {customer.email}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Invoice number (optional)">
                        <input
                          className="form-input"
                          name="invoiceNumber"
                          placeholder={`INV-${Date.now().toString().slice(-6)}`}
                        />
                      </Field>
                      <Field label="Invoice amount (₹)">
                        <input
                          className="form-input"
                          name="totalAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          placeholder="25000"
                        />
                      </Field>
                      <Field label="Due date">
                        <input
                          className="form-input"
                          name="dueDate"
                          type="date"
                          min={today}
                          required
                        />
                      </Field>
                    </>
                  )}
                </>
              )}

              {modal === 'payment' && (
                <>
                  {invoices.filter(invoice => outstanding(invoice) > 0).length === 0 ? (
                    <div className="inline-warning">
                      <CheckCircle2 size={18} />
                      There are no outstanding invoices to pay.
                    </div>
                  ) : (
                    <>
                      <Field label="Invoice / customer">
                        <select
                          className="form-input"
                          name="invoiceId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select an outstanding invoice
                          </option>
                          {invoices
                            .filter(invoice =>
                              outstanding(invoice) > 0 &&
                              (!selectedCustomer ||
                                invoice.customerId === selectedCustomer.id ||
                                invoice.customer?.id === selectedCustomer.id),
                            )
                            .map(invoice => (
                              <option key={invoice.id} value={invoice.id}>
                                {invoice.invoiceNumber} · {customerName(invoice)} · Due {money(outstanding(invoice))}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Payment amount (₹)">
                        <input
                          className="form-input"
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          placeholder="5000"
                        />
                      </Field>
                      <Field label="Payment date">
                        <input
                          className="form-input"
                          name="paymentDate"
                          type="date"
                          max={today}
                          defaultValue={today}
                          required
                        />
                      </Field>
                      <Field label="Payment method">
                        <select
                          className="form-input"
                          name="paymentMethod"
                          defaultValue="UPI"
                        >
                          {['UPI', 'Cash', 'Bank transfer', 'Card', 'Cheque', 'Other'].map(method => (
                            <option key={method}>{method}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Reference number (optional)">
                        <input
                          className="form-input"
                          name="referenceNumber"
                          placeholder="Transaction ID / receipt number"
                        />
                      </Field>
                    </>
                  )}
                </>
              )}

              {error && (
                <p className="form-error">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <div className="custom-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    busy ||
                    (modal === 'invoice' && customers.length === 0) ||
                    (modal === 'payment' &&
                      !invoices.some(invoice => outstanding(invoice) > 0))
                  }
                >
                  {busy
                    ? <RefreshCw className="spin" size={16} />
                    : <Plus size={16} />}
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <label className="field-label">{label}{children}</label>;
}

function SearchTools({
  search,
  setSearch,
  placeholder,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="table-tools">
      <div className="search-box">
        <Search size={17} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      {children}
    </div>
  );
}

function EmptyRow({
  columns,
  text,
}: {
  columns: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={columns} className="empty-state">{text}</td>
    </tr>
  );
}

function Metric({
  title,
  value,
  change,
  icon,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  icon: ReactNode;
  trend: 'up' | 'down';
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{title}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className={`metric-change ${trend}`}>
        {trend === 'up'
          ? <ArrowUpRight size={14} />
          : <ArrowDownRight size={14} />}
        {change}
      </div>
    </div>
  );
}

export default App;
