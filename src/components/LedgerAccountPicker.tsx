import { useState, useEffect, type ReactNode } from 'react';
import type { LedgerAccount } from '../types';

export type LedgerPickerStyles = {
  container?: React.CSSProperties;
  header?: React.CSSProperties;
  row?: React.CSSProperties;
  index?: React.CSSProperties;
  address?: React.CSSProperties;
  balance?: React.CSSProperties;
  selectBtn?: React.CSSProperties;
  footer?: React.CSSProperties;
  loadMoreBtn?: React.CSSProperties;
  cancelBtn?: React.CSSProperties;
  status?: React.CSSProperties;
  error?: React.CSSProperties;
};

export interface LedgerAccountPickerProps {
  chain: 'solana' | 'evm';
  getAccounts: (count: number, offset: number) => Promise<LedgerAccount[]>;
  onSelect: (account: LedgerAccount) => void;
  onCancel: () => void;
  /** Override any subset of the default inline styles. */
  styles?: LedgerPickerStyles;
  /**
   * Fully replace the rendering of a single account row.
   * Receive the account, the balance symbol, and a ready-to-call `select` function.
   */
  renderAccount?: (account: LedgerAccount, symbol: string, select: () => void) => ReactNode;
}

const PAGE_SIZE = 5;

const DEFAULT_STYLES: Required<LedgerPickerStyles> = {
  container: {
    border: '2px solid #1565c0',
    borderRadius: '8px',
    padding: '12px',
    background: '#e3f2fd',
    fontSize: '13px',
  },
  header: {
    fontWeight: 700,
    marginBottom: '8px',
    color: '#0d47a1',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 4px',
    borderBottom: '1px solid #bbdefb',
  },
  index: {
    width: '20px',
    color: '#555',
    flexShrink: 0,
  },
  address: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  balance: {
    width: '80px',
    textAlign: 'right',
    flexShrink: 0,
    color: '#333',
  },
  selectBtn: {
    padding: '3px 10px',
    border: '1px solid #1976d2',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    flexShrink: 0,
  },
  footer: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    justifyContent: 'space-between',
  },
  loadMoreBtn: {
    padding: '5px 12px',
    border: '1px solid #1976d2',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  cancelBtn: {
    padding: '5px 12px',
    border: '1px solid #c62828',
    borderRadius: '4px',
    background: '#ffebee',
    cursor: 'pointer',
    fontSize: '12px',
  },
  status: {
    color: '#555',
    padding: '6px 0',
    textAlign: 'center',
  },
  error: {
    color: '#c62828',
    background: '#ffebee',
    padding: '6px 8px',
    borderRadius: '4px',
  },
};

function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

export function LedgerAccountPicker({
  chain,
  getAccounts,
  onSelect,
  onCancel,
  styles: styleOverrides,
  renderAccount,
}: LedgerAccountPickerProps): ReactNode {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = chain === 'solana' ? 'SOL' : 'ETH';

  // Merge caller overrides on top of defaults — undefined keys keep the default.
  const s: Required<LedgerPickerStyles> = {
    container:   { ...DEFAULT_STYLES.container,   ...styleOverrides?.container },
    header:      { ...DEFAULT_STYLES.header,      ...styleOverrides?.header },
    row:         { ...DEFAULT_STYLES.row,         ...styleOverrides?.row },
    index:       { ...DEFAULT_STYLES.index,       ...styleOverrides?.index },
    address:     { ...DEFAULT_STYLES.address,     ...styleOverrides?.address },
    balance:     { ...DEFAULT_STYLES.balance,     ...styleOverrides?.balance },
    selectBtn:   { ...DEFAULT_STYLES.selectBtn,   ...styleOverrides?.selectBtn },
    footer:      { ...DEFAULT_STYLES.footer,      ...styleOverrides?.footer },
    loadMoreBtn: { ...DEFAULT_STYLES.loadMoreBtn, ...styleOverrides?.loadMoreBtn },
    cancelBtn:   { ...DEFAULT_STYLES.cancelBtn,   ...styleOverrides?.cancelBtn },
    status:      { ...DEFAULT_STYLES.status,      ...styleOverrides?.status },
    error:       { ...DEFAULT_STYLES.error,       ...styleOverrides?.error },
  };

  const loadPage = async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const batch = await getAccounts(PAGE_SIZE, offset);
      setAccounts(prev => offset === 0 ? batch : [...prev, ...batch]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load accounts. Is your Ledger connected with the app open?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPage(0); }, []);

  return (
    <div style={s.container}>
      <div style={s.header}>Select Ledger Account</div>

      {error && (
        <div style={s.error}>
          {error}
          <button style={{ ...s.loadMoreBtn, marginLeft: 8 }} onClick={() => loadPage(accounts.length)}>
            Retry
          </button>
        </div>
      )}

      {accounts.map(account =>
        renderAccount ? (
          <div key={account.path}>{renderAccount(account, symbol, () => onSelect(account))}</div>
        ) : (
          <div key={account.path} style={s.row}>
            <span style={s.index}>#{account.index}</span>
            <span style={s.address} title={account.address}>{shorten(account.address)}</span>
            <span style={s.balance}>{account.balance.toFixed(4)} {symbol}</span>
            <button style={s.selectBtn} onClick={() => onSelect(account)}>Select</button>
          </div>
        )
      )}

      {loading && <div style={s.status}>Loading accounts…</div>}

      <div style={s.footer}>
        <button style={s.loadMoreBtn} disabled={loading} onClick={() => loadPage(accounts.length)}>
          Load more
        </button>
        <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
