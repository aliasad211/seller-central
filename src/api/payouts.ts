// Earnings > Withdraw: the shop owner's withdrawable balance (their Fazl
// merchant wallet), the accounts they're paid into — a bank, JazzCash or
// Easypaisa — and their withdrawal requests, which Fazl's team approves and
// pays. The owner's own login only. Amounts here are whole rupees.
import { api } from './http';

export type PayoutMethod = 'bank_transfer' | 'jazzcash' | 'easypaisa';
export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface PayoutSummary {
  /** In the wallet and free to use. */
  available: number;
  /** Asked for already and not yet paid or refused. */
  inRequests: number;
  /** What a new request can be for now. */
  withdrawable: number;
  totalWithdrawn: number;
  isFrozen: boolean;
  minWithdrawal: number;
  maxWithdrawal: number;
  /** False while Fazl has withdrawals switched off. */
  withdrawalsOpen: boolean;
}

export interface PayoutAccount {
  id: string;
  method: PayoutMethod;
  accountTitle: string;
  /** The bank account number, or the JazzCash / Easypaisa mobile number. */
  accountNumber: string;
  bankName?: string | null;
  iban?: string | null;
  isDefault: boolean;
}

export interface WithdrawalRequest {
  id: string;
  code?: string | null;
  amount: number;
  method: PayoutMethod | 'other';
  accountTitle: string;
  accountNumber: string;
  bankName?: string | null;
  status: WithdrawalStatus;
  rejectionReason?: string | null;
  createdAt: string;
  completedDate?: string | null;
}

const rupees = (minor: number | null | undefined) => Math.round((minor ?? 0) / 100);

export async function getPayoutSummary(): Promise<PayoutSummary> {
  const s = await api<{
    availableMinor: number;
    inRequestsMinor: number;
    withdrawableMinor: number;
    totalWithdrawnMinor: number;
    isFrozen: boolean;
    minWithdrawalMinor: number;
    maxWithdrawalMinor: number;
    withdrawalsOpen: boolean;
  }>('/seller/payouts');
  return {
    available: rupees(s.availableMinor),
    inRequests: rupees(s.inRequestsMinor),
    withdrawable: rupees(s.withdrawableMinor),
    totalWithdrawn: rupees(s.totalWithdrawnMinor),
    isFrozen: s.isFrozen,
    minWithdrawal: rupees(s.minWithdrawalMinor),
    maxWithdrawal: rupees(s.maxWithdrawalMinor),
    withdrawalsOpen: s.withdrawalsOpen,
  };
}

export function listPayoutAccounts(): Promise<PayoutAccount[]> {
  return api<PayoutAccount[]>('/seller/payouts/accounts');
}

export function addPayoutAccount(draft: {
  method: PayoutMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  iban?: string;
  isDefault?: boolean;
}): Promise<PayoutAccount> {
  return api<PayoutAccount>('/seller/payouts/accounts', { method: 'POST', body: draft });
}

export function setDefaultPayoutAccount(id: string): Promise<PayoutAccount[]> {
  return api<PayoutAccount[]>(`/seller/payouts/accounts/${id}/default`, { method: 'PATCH' });
}

export function removePayoutAccount(id: string): Promise<PayoutAccount[]> {
  return api<PayoutAccount[]>(`/seller/payouts/accounts/${id}`, { method: 'DELETE' });
}

type BackendWithdrawal = Omit<WithdrawalRequest, 'amount'> & { amountMinor: number };

export async function listWithdrawals(): Promise<WithdrawalRequest[]> {
  const rows = await api<BackendWithdrawal[]>('/seller/payouts/withdrawals?limit=50');
  return rows.map(({ amountMinor, ...w }) => ({ ...w, amount: rupees(amountMinor) }));
}

export function requestWithdrawal(amount: number, accountId: string): Promise<unknown> {
  return api('/seller/payouts/withdrawals', {
    method: 'POST',
    body: { amount, accountId },
  });
}

export function cancelWithdrawal(id: string): Promise<unknown> {
  return api(`/seller/payouts/withdrawals/${id}/cancel`, { method: 'POST' });
}

/** "•••• 4321": enough to tell accounts apart without showing the whole number. */
export function maskedNumber(accountNumber: string): string {
  const tail = accountNumber.replace(/\s/g, '').slice(-4);
  return `•••• ${tail}`;
}
