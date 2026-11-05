export type StaffRole = 'admin' | 'manager' | 'stock_clerk' | 'showroom_sales' | 'finance';

export type LocationType = 'warehouse' | 'showroom';

export interface Location {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  address: string;
  phone: string;
  isCustomerAvailable: boolean;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  collection: string;
  category: string;
  description: string;
  dimensions: string;
  materials: string;
  imageUrl: string;
  referencePrice: number;
  isActive: boolean;
}

export interface StockBalance {
  productId: string;
  locationId: string;
  sellableOnHand: number;
  activeReserved: number;
  damagedCount: number;
  quarantineCount: number;
  updatedAt: string;
}

export type MovementType = 
  | 'receipt'
  | 'transfer_out'
  | 'transfer_in'
  | 'reservation_hold'
  | 'reservation_release'
  | 'sale_fulfilment'
  | 'count_adjustment'
  | 'quarantine_damage'
  | 'warranty_return';

export interface StockMovement {
  id: string;
  productId: string;
  sourceLocationId?: string;
  destLocationId?: string;
  movementType: MovementType;
  quantity: number;
  referenceNo: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export type OrderStatus = 
  | 'draft'
  | 'reserved'
  | 'confirmed'
  | 'partially_paid'
  | 'paid'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export interface SalesOrderLine {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  locationId: string;
  status: OrderStatus;
  lines: SalesOrderLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  tinNumber?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  locationId: string;
  quantity: number;
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'card';

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ExceptionCase {
  id: string;
  caseNumber: string;
  caseType: 'return' | 'damage' | 'warranty';
  productId: string;
  locationId: string;
  quantity: number;
  disposition: 'pending_inspection' | 'quarantined' | 'restocked_sellable' | 'written_off';
  customerName?: string;
  orderNumber?: string;
  issueDescription: string;
  resolutionNotes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  defaultLocationId: string;
  isActive: boolean;
}

export interface AuditEvent {
  id: string;
  actorName: string;
  action: string;
  entityName: string;
  entityId: string;
  details: string;
  createdAt: string;
}

// Public feed view model (for et.maisondebrah.com)
export interface PublicAvailabilityFeedItem {
  sku: string;
  name: string;
  collection: string;
  category: string;
  imageUrl: string;
  dimensions: string;
  materials: string;
  availabilityStatus: 'in_stock' | 'available_to_order';
}
