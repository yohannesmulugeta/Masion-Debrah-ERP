import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Location, Product, StockBalance, StockMovement, SalesOrder, Customer,
  Reservation, Payment, ExceptionCase, StaffProfile, AuditEvent, StaffRole,
  PublicAvailabilityFeedItem, DeliveryRecord, RefundRecord
} from '../types';
import {
  INITIAL_LOCATIONS, INITIAL_PRODUCTS, INITIAL_BALANCES, INITIAL_STAFF,
  INITIAL_CUSTOMERS, INITIAL_ORDERS, INITIAL_RESERVATIONS, INITIAL_PAYMENTS,
  INITIAL_MOVEMENTS, INITIAL_EXCEPTIONS, INITIAL_AUDIT
} from '../lib/mockData';
import { previewCatalogueImport } from '../lib/catalogueImport';
import { deliveryStatus, planDispatch, remainingToDispatch } from '../lib/deliveryOperations';
import { planFullRefund } from '../lib/financeOperations';

interface ErpContextType {
  staffList: StaffProfile[];
  currentStaff: StaffProfile;
  setCurrentStaffRole: (role: StaffRole) => void;
  setCurrentStaff: (staff: StaffProfile) => void;
  locations: Location[];
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  products: Product[];
  balances: StockBalance[];
  movements: StockMovement[];
  orders: SalesOrder[];
  customers: Customer[];
  reservations: Reservation[];
  payments: Payment[];
  refunds: RefundRecord[];
  deliveries: DeliveryRecord[];
  exceptions: ExceptionCase[];
  auditEvents: AuditEvent[];

  // Permissions check
  canPerform: (action: string) => boolean;

  // Calculators
  getProductStock: (productId: string, locationId?: string) => {
    sellableOnHand: number;
    activeReserved: number;
    available: number;
    damagedCount: number;
  };
  getPublicAvailabilityFeed: () => PublicAvailabilityFeedItem[];

  // Core Business Actions
  postReceipt: (data: { productId: string; locationId: string; quantity: number; referenceNo: string; reason: string }) => void;
  postTransfer: (data: { productId: string; sourceLocationId: string; destLocationId: string; quantity: number; referenceNo: string; reason: string }) => void;
  createOrder: (data: { customerName: string; customerPhone: string; locationId: string; items: { productId: string; quantity: number; unitPrice: number }[]; notes?: string }) => string;
  createReservation: (data: { orderId: string; productId: string; locationId: string; quantity: number; expiresAt: string; reviewAt: string }) => void;
  extendReservation: (data: { reservationId: string; expiresAt: string; reviewAt: string; reason: string }) => void;
  releaseReservation: (data: { reservationId: string; reason: string }) => void;
  dispatchOrderLine: (data: { orderId: string; lineId: string; quantity: number; locationId: string; deliveryAddress: string; intendedRecipient: string }) => void;
  confirmDelivery: (data: { deliveryId: string; signedBy: string; signedReference: string }) => void;
  failDelivery: (data: { deliveryId: string; reason: string }) => void;
  receiveFailedDelivery: (deliveryId: string) => void;
  recordPayment: (data: { orderId: string; amount: number; paymentMethod: Payment['paymentMethod']; referenceNo: string; notes?: string }) => void;
  refundAndCancelOrder: (data: { orderId: string; reason: string; referenceNo: string }) => void;
  recordAdjustment: (data: { productId: string; locationId: string; newQuantity: number; reason: string }) => void;
  createException: (data: { caseType: ExceptionCase['caseType']; productId: string; locationId: string; quantity: number; disposition: ExceptionCase['disposition']; issueDescription: string; customerName?: string; orderNumber?: string }) => void;
  importCatalogueBatch: (newProducts: Product[]) => { imported: number; duplicates: number; blankSkus: number };
  resetToBaseline: () => void;
}

const ErpContext = createContext<ErpContextType | null>(null);

const STORAGE_KEY = 'maison_debrah_erp_state_v1';

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staffList] = useState<StaffProfile[]>(INITIAL_STAFF);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile>(INITIAL_STAFF[0]); // Starts as Admin
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [locations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_products`);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [balances, setBalances] = useState<StockBalance[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_balances`);
    return saved ? JSON.parse(saved) : INITIAL_BALANCES;
  });
  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_movements`);
    return saved ? JSON.parse(saved) : INITIAL_MOVEMENTS;
  });
  const [orders, setOrders] = useState<SalesOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_orders`);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_customers`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_reservations`);
    return saved ? JSON.parse(saved) : INITIAL_RESERVATIONS;
  });
  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_payments`);
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });
  const [refunds, setRefunds] = useState<RefundRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_refunds`);
    return saved ? JSON.parse(saved) : [];
  });
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_deliveries`);
    return saved ? JSON.parse(saved) : [];
  });
  const [exceptions, setExceptions] = useState<ExceptionCase[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_exceptions`);
    return saved ? JSON.parse(saved) : INITIAL_EXCEPTIONS;
  });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit`);
    return saved ? JSON.parse(saved) : INITIAL_AUDIT;
  });

  // Save changes to localStorage for persistent live demonstration
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_products`, JSON.stringify(products));
    localStorage.setItem(`${STORAGE_KEY}_balances`, JSON.stringify(balances));
    localStorage.setItem(`${STORAGE_KEY}_movements`, JSON.stringify(movements));
    localStorage.setItem(`${STORAGE_KEY}_orders`, JSON.stringify(orders));
    localStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(customers));
    localStorage.setItem(`${STORAGE_KEY}_reservations`, JSON.stringify(reservations));
    localStorage.setItem(`${STORAGE_KEY}_payments`, JSON.stringify(payments));
    localStorage.setItem(`${STORAGE_KEY}_refunds`, JSON.stringify(refunds));
    localStorage.setItem(`${STORAGE_KEY}_deliveries`, JSON.stringify(deliveries));
    localStorage.setItem(`${STORAGE_KEY}_exceptions`, JSON.stringify(exceptions));
    localStorage.setItem(`${STORAGE_KEY}_audit`, JSON.stringify(auditEvents));
  }, [products, balances, movements, orders, customers, reservations, payments, refunds, deliveries, exceptions, auditEvents]);

  const setCurrentStaffRole = (role: StaffRole) => {
    const match = staffList.find(s => s.role === role);
    if (match) {
      setCurrentStaff(match);
    } else {
      setCurrentStaff(prev => ({ ...prev, role }));
    }
  };

  const addAudit = (action: string, entityName: string, entityId: string, details: string) => {
    const event: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorName: `${currentStaff.fullName} (${currentStaff.role})`,
      action,
      entityName,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    };
    setAuditEvents(prev => [event, ...prev]);
  };

  // Role permissions checking matrix
  const canPerform = (action: string): boolean => {
    const role = currentStaff.role;
    switch (action) {
      case 'import_catalogue':
        return role === 'admin' || role === 'manager';
      case 'post_receipt':
        return role === 'admin' || role === 'manager' || role === 'stock_clerk';
      case 'post_transfer':
        return role === 'admin' || role === 'manager' || role === 'stock_clerk';
      case 'approve_adjustment':
        return role === 'admin' || role === 'manager';
      case 'create_order':
        return role === 'admin' || role === 'manager' || role === 'showroom_sales';
      case 'create_reservation':
        return role === 'admin' || role === 'manager' || role === 'showroom_sales';
      case 'release_reservation':
        return role === 'admin' || role === 'manager' || role === 'showroom_sales';
      case 'fulfil_order':
        return role === 'admin' || role === 'manager' || role === 'stock_clerk';
      case 'record_payment':
        return role === 'finance';
      case 'approve_refund':
        return role === 'finance';
      case 'manage_exceptions':
        return role === 'admin' || role === 'manager' || role === 'stock_clerk';
      case 'view_audit':
        return role === 'admin' || role === 'manager';
      default:
        return false;
    }
  };

  // Safe stock calculation
  const getProductStock = (productId: string, locationId?: string) => {
    let filtered = balances.filter(b => b.productId === productId);
    if (locationId && locationId !== 'all') {
      filtered = filtered.filter(b => b.locationId === locationId);
    }
    const sellableOnHand = filtered.reduce((acc, b) => acc + b.sellableOnHand, 0);
    const activeReserved = filtered.reduce((acc, b) => acc + b.activeReserved, 0);
    const damagedCount = filtered.reduce((acc, b) => acc + b.damagedCount, 0);
    const available = Math.max(0, sellableOnHand - activeReserved);

    return { sellableOnHand, activeReserved, available, damagedCount };
  };

  // Strictly implements the website status invariant:
  // Shows 'in_stock' only when unreserved sellable stock > 0 across customer-available locations.
  // Contains ZERO raw count or customer leak!
  const getPublicAvailabilityFeed = (): PublicAvailabilityFeedItem[] => {
    return products.map(prod => {
      let customerAvailQty = 0;
      for (const loc of locations) {
        if (loc.isCustomerAvailable) {
          const b = balances.find(item => item.productId === prod.id && item.locationId === loc.id);
          if (b) {
            customerAvailQty += Math.max(0, b.sellableOnHand - b.activeReserved);
          }
        }
      }
      return {
        sku: prod.sku,
        name: prod.name,
        collection: prod.collection,
        category: prod.category,
        imageUrl: prod.imageUrl,
        dimensions: prod.dimensions,
        materials: prod.materials,
        availabilityStatus: customerAvailQty > 0 ? 'in_stock' : 'available_to_order',
      };
    });
  };

  // 1. Post Goods Receipt
  const postReceipt = (data: { productId: string; locationId: string; quantity: number; referenceNo: string; reason: string }) => {
    if (!canPerform('post_receipt')) throw new Error('Unauthorized to post stock receipts.');
    if (data.quantity <= 0) throw new Error('Receipt quantity must be positive.');

    setBalances(prev => {
      const idx = prev.findIndex(b => b.productId === data.productId && b.locationId === data.locationId);
      const now = new Date().toISOString();
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          sellableOnHand: copy[idx].sellableOnHand + data.quantity,
          updatedAt: now,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            productId: data.productId,
            locationId: data.locationId,
            sellableOnHand: data.quantity,
            activeReserved: 0,
            damagedCount: 0,
            quarantineCount: 0,
            updatedAt: now,
          },
        ];
      }
    });

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: data.productId,
      destLocationId: data.locationId,
      movementType: 'receipt',
      quantity: data.quantity,
      referenceNo: data.referenceNo,
      reason: data.reason,
      createdBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };
    setMovements(prev => [mov, ...prev]);

    const prod = products.find(p => p.id === data.productId);
    const loc = locations.find(l => l.id === data.locationId);
    addAudit('RECEIPT_POSTED', 'stock_balances', data.productId, `Received ${data.quantity} units of ${prod?.sku} at ${loc?.name} (Ref: ${data.referenceNo})`);
  };

  // 2. Post Inter-Location Transfer
  const postTransfer = (data: { productId: string; sourceLocationId: string; destLocationId: string; quantity: number; referenceNo: string; reason: string }) => {
    if (!canPerform('post_transfer')) throw new Error('Unauthorized to transfer stock.');
    if (data.quantity <= 0) throw new Error('Transfer quantity must be positive.');
    if (data.sourceLocationId === data.destLocationId) throw new Error('Source and destination locations cannot be identical.');

    const srcBalance = balances.find(b => b.productId === data.productId && b.locationId === data.sourceLocationId);
    const available = (srcBalance?.sellableOnHand || 0) - (srcBalance?.activeReserved || 0);

    if (available < data.quantity) {
      throw new Error(`Insufficient unreserved stock at source location. Available: ${available}, Requested: ${data.quantity}`);
    }

    setBalances(prev => {
      const now = new Date().toISOString();
      const updated = prev.map(b => {
        if (b.productId === data.productId && b.locationId === data.sourceLocationId) {
          return { ...b, sellableOnHand: b.sellableOnHand - data.quantity, updatedAt: now };
        }
        if (b.productId === data.productId && b.locationId === data.destLocationId) {
          return { ...b, sellableOnHand: b.sellableOnHand + data.quantity, updatedAt: now };
        }
        return b;
      });

      // If dest didn't have a record yet, create it
      const destExists = prev.some(b => b.productId === data.productId && b.locationId === data.destLocationId);
      if (!destExists) {
        updated.push({
          productId: data.productId,
          locationId: data.destLocationId,
          sellableOnHand: data.quantity,
          activeReserved: 0,
          damagedCount: 0,
          quarantineCount: 0,
          updatedAt: now,
        });
      }
      return updated;
    });

    const now = new Date().toISOString();
    const movOut: StockMovement = {
      id: `mov-${Date.now()}-out`,
      productId: data.productId,
      sourceLocationId: data.sourceLocationId,
      destLocationId: data.destLocationId,
      movementType: 'transfer_out',
      quantity: data.quantity,
      referenceNo: data.referenceNo,
      reason: data.reason,
      createdBy: currentStaff.fullName,
      createdAt: now,
    };
    const movIn: StockMovement = {
      id: `mov-${Date.now()}-in`,
      productId: data.productId,
      sourceLocationId: data.sourceLocationId,
      destLocationId: data.destLocationId,
      movementType: 'transfer_in',
      quantity: data.quantity,
      referenceNo: data.referenceNo,
      reason: data.reason,
      createdBy: currentStaff.fullName,
      createdAt: now,
    };
    setMovements(prev => [movOut, movIn, ...prev]);

    const srcLoc = locations.find(l => l.id === data.sourceLocationId);
    const destLoc = locations.find(l => l.id === data.destLocationId);
    const prod = products.find(p => p.id === data.productId);
    addAudit('TRANSFER_POSTED', 'stock_balances', data.productId, `Transferred ${data.quantity} units of ${prod?.sku} from ${srcLoc?.name} to ${destLoc?.name} (Ref: ${data.referenceNo})`);
  };

  // 3. Create Sales Order
  const createOrder = (data: { customerName: string; customerPhone: string; locationId: string; items: { productId: string; quantity: number; unitPrice: number }[]; notes?: string }): string => {
    if (!canPerform('create_order')) throw new Error('Unauthorized to create sales orders.');
    if (!data.customerName.trim() || !data.customerPhone.trim()) throw new Error('Customer name and phone are required.');
    if (!locations.some(loc => loc.id === data.locationId && loc.type === 'showroom')) throw new Error('Choose a valid showroom.');
    if (data.items.length === 0) throw new Error('Add at least one product.');
    for (const item of data.items) {
      if (!products.some(product => product.id === item.productId)) throw new Error('Choose a valid product.');
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('Order quantity must be a positive whole number.');
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Enter a valid unit price.');
    }

    // Ensure customer exists or create new
    let customer = customers.find(c => c.phone === data.customerPhone);
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        fullName: data.customerName,
        phone: data.customerPhone,
        createdAt: new Date().toISOString(),
      };
      setCustomers(prev => [...prev, customer!]);
    }

    const orderId = `ord-${crypto.randomUUID()}`;
    const orderNumber = `MD-ORD-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const lines = data.items.map((item, i) => ({
      id: `line-${orderId}-${i}`,
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    }));

    const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);

    const newOrder: SalesOrder = {
      id: orderId,
      orderNumber,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      locationId: data.locationId,
      status: 'confirmed',
      lines,
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: subtotal,
      paidAmount: 0,
      balanceDue: subtotal,
      notes: data.notes,
      createdBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);
    addAudit('ORDER_CREATED', 'sales_orders', orderId, `Created sales order ${orderNumber} for ${customer.fullName} totaling ETB ${subtotal.toLocaleString()}`);

    return orderId;
  };

  // 4. Create Stock Reservation (Hold)
  const createReservation = (data: { orderId: string; productId: string; locationId: string; quantity: number; expiresAt: string; reviewAt: string }) => {
    if (!canPerform('create_reservation')) throw new Error('Unauthorized to create reservations.');
    if (!Number.isSafeInteger(data.quantity) || data.quantity <= 0) throw new Error('Reservation quantity must be a positive whole number.');
    const order = orders.find(item => item.id === data.orderId);
    if (!order || order.status === 'cancelled' || order.status === 'delivered') throw new Error('Choose an open order.');
    if (order.paidAmount <= 0) throw new Error('Finance must record a deposit before reserving stock.');
    const line = order.lines.find(item => item.productId === data.productId);
    if (!line || data.quantity > remainingToDispatch(order, line.id, deliveries)) throw new Error('Reservation exceeds the undelivered order item quantity.');
    if (reservations.some(item => item.orderId === order.id && item.productId === data.productId && item.status === 'active')) throw new Error('This item already has an active reservation.');
    if (!Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new Error('Choose a future collection or delivery date.');
    if (!Number.isFinite(Date.parse(data.reviewAt)) || Date.parse(data.reviewAt) <= Date.now() || Date.parse(data.reviewAt) > Date.parse(data.expiresAt)) throw new Error('Choose a review date before the agreed collection date.');

    const b = balances.find(item => item.productId === data.productId && item.locationId === data.locationId);
    const available = (b?.sellableOnHand || 0) - (b?.activeReserved || 0);

    if (available < data.quantity) {
      throw new Error(`Insufficient unreserved stock to place hold. Available: ${available}, Requested: ${data.quantity}`);
    }

    // Increase active_reserved
    setBalances(prev => {
      const now = new Date().toISOString();
      return prev.map(item => {
        if (item.productId === data.productId && item.locationId === data.locationId) {
          return {
            ...item,
            activeReserved: item.activeReserved + data.quantity,
            updatedAt: now,
          };
        }
        return item;
      });
    });

    const expiresAt = new Date(data.expiresAt).toISOString();

    const res: Reservation = {
      id: `res-${Date.now()}`,
      orderId: data.orderId,
      orderNumber: order.orderNumber,
      productId: data.productId,
      locationId: data.locationId,
      quantity: data.quantity,
      status: 'active',
      expiresAt,
      reviewAt: new Date(data.reviewAt).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setReservations(prev => [res, ...prev]);

    // Update order status if draft/confirmed

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: data.productId,
      sourceLocationId: data.locationId,
      movementType: 'reservation_hold',
      quantity: data.quantity,
      referenceNo: order.orderNumber,
      reason: `Deposit reservation until ${expiresAt}`,
      createdBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };
    setMovements(prev => [mov, ...prev]);

    addAudit('RESERVATION_CREATED', 'reservations', res.id, `Reserved ${data.quantity} units of product ${data.productId} for order ${order.orderNumber}`);
  };

  const extendReservation = (data: { reservationId: string; expiresAt: string; reviewAt: string; reason: string }) => {
    if (!canPerform('create_reservation')) throw new Error('Unauthorized to extend reservations.');
    const reservation = reservations.find(item => item.id === data.reservationId);
    if (!reservation || reservation.status !== 'active') throw new Error('Active reservation not found.');
    if (!data.reason.trim()) throw new Error('Record the customer discussion and reason for extension.');
    if (!Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new Error('Choose a future collection date.');
    if (!Number.isFinite(Date.parse(data.reviewAt)) || Date.parse(data.reviewAt) <= Date.now() || Date.parse(data.reviewAt) > Date.parse(data.expiresAt)) throw new Error('Choose a review date before collection.');
    setReservations(prev => prev.map(item => item.id === reservation.id ? { ...item, expiresAt: new Date(data.expiresAt).toISOString(), reviewAt: new Date(data.reviewAt).toISOString() } : item));
    addAudit('RESERVATION_EXTENDED', 'reservations', reservation.id, data.reason.trim());
  };

  // 5. Release Reservation
  const releaseReservation = (data: { reservationId: string; reason: string }) => {
    if (!canPerform('release_reservation')) throw new Error('Unauthorized to release reservations.');
    if (!data.reason.trim()) throw new Error('Enter a reason for releasing the reservation.');
    const res = reservations.find(r => r.id === data.reservationId);
    if (!res || res.status !== 'active') throw new Error('Active reservation not found.');
    const order = orders.find(item => item.id === res.orderId);
    if (order && order.paidAmount > 0) throw new Error('A paid reservation needs Finance review. Extend it or refund and cancel the order.');

    // Decrement active_reserved
    setBalances(prev => {
      const now = new Date().toISOString();
      return prev.map(item => {
        if (item.productId === res.productId && item.locationId === res.locationId) {
          return {
            ...item,
            activeReserved: Math.max(0, item.activeReserved - res.quantity),
            updatedAt: now,
          };
        }
        return item;
      });
    });

    setReservations(prev => prev.map(r => r.id === data.reservationId ? { ...r, status: 'cancelled' } : r));

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: res.productId,
      destLocationId: res.locationId,
      movementType: 'reservation_release',
      quantity: res.quantity,
      referenceNo: res.orderNumber,
      reason: data.reason,
      createdBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };
    setMovements(prev => [mov, ...prev]);

    addAudit('RESERVATION_RELEASED', 'reservations', res.id, `Released hold of ${res.quantity} units for order ${res.orderNumber} (${data.reason})`);
  };

  // Demo-only handover steps. The live version must perform these as database transactions.
  const dispatchOrderLine = (data: { orderId: string; lineId: string; quantity: number; locationId: string; deliveryAddress: string; intendedRecipient: string }) => {
    if (!canPerform('fulfil_order')) throw new Error('Unauthorized to release stock.');
    const order = orders.find(item => item.id === data.orderId);
    if (!order) throw new Error('Order not found.');
    if (!data.deliveryAddress.trim() || !data.intendedRecipient.trim()) throw new Error('Enter the delivery address and intended recipient.');
    const now = new Date().toISOString();
    const plan = planDispatch(order, data.lineId, data.quantity, data.locationId, balances, reservations, deliveries, now);
    const line = order.lines.find(item => item.id === data.lineId)!;
    const delivery: DeliveryRecord = {
      id: `del-${crypto.randomUUID()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      lineId: line.id,
      productId: line.productId,
      quantity: data.quantity,
      sourceLocationId: plan.sourceLocationId,
      deliveryAddress: data.deliveryAddress.trim(),
      intendedRecipient: data.intendedRecipient.trim(),
      status: 'dispatched',
      dispatchedAt: now,
      dispatchedBy: currentStaff.fullName,
    };
    const nextDeliveries = [delivery, ...deliveries];
    setBalances(plan.balances);
    setReservations(plan.reservations);
    setDeliveries(nextDeliveries);
    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: deliveryStatus(item, nextDeliveries) } : item));
    setMovements(prev => [{
      id: `mov-${crypto.randomUUID()}`,
      productId: line.productId,
      sourceLocationId: plan.sourceLocationId,
      movementType: 'sale_fulfilment',
      quantity: data.quantity,
      referenceNo: delivery.id,
      reason: `Dispatched for ${order.orderNumber}`,
      createdBy: currentStaff.fullName,
      createdAt: now,
    }, ...prev]);
    addAudit('ORDER_LINE_DISPATCHED', 'deliveries', delivery.id, `${data.quantity} unit(s) dispatched for ${order.orderNumber}; awaiting signed handover`);
  };

  const confirmDelivery = (data: { deliveryId: string; signedBy: string; signedReference: string }) => {
    if (!canPerform('fulfil_order')) throw new Error('Unauthorized to confirm delivery.');
    const record = deliveries.find(item => item.id === data.deliveryId);
    if (!record || record.status !== 'dispatched') throw new Error('An open dispatch was not found.');
    if (!data.signedBy.trim() || !data.signedReference.trim()) throw new Error('Enter the signatory and signed document reference.');
    const nextDeliveries: DeliveryRecord[] = deliveries.map(item => item.id === data.deliveryId ? {
      ...item, status: 'delivered', signedBy: data.signedBy.trim(), signedReference: data.signedReference.trim(), signedAt: new Date().toISOString(),
    } : item);
    setDeliveries(nextDeliveries);
    setOrders(prev => prev.map(item => item.id === record.orderId ? { ...item, status: deliveryStatus(item, nextDeliveries) } : item));
    addAudit('DELIVERY_SIGNED', 'deliveries', record.id, `Signed by ${data.signedBy.trim()} for ${record.orderNumber}; reference ${data.signedReference.trim()}`);
  };

  const failDelivery = (data: { deliveryId: string; reason: string }) => {
    if (!canPerform('fulfil_order')) throw new Error('Unauthorized to record failed delivery.');
    const record = deliveries.find(item => item.id === data.deliveryId);
    if (!record || record.status !== 'dispatched') throw new Error('An open dispatch was not found.');
    if (!data.reason.trim()) throw new Error('Enter why delivery failed.');
    setDeliveries(prev => prev.map(item => item.id === record.id ? { ...item, status: 'failed', failureReason: data.reason.trim() } : item));
    addAudit('DELIVERY_FAILED', 'deliveries', record.id, data.reason.trim());
  };

  const receiveFailedDelivery = (deliveryId: string) => {
    if (!canPerform('post_receipt')) throw new Error('Unauthorized to receive returned goods.');
    const record = deliveries.find(item => item.id === deliveryId);
    if (!record || record.status !== 'failed') throw new Error('A failed delivery awaiting return was not found.');
    const now = new Date().toISOString();
    setBalances(prev => prev.map(item => item.productId === record.productId && item.locationId === record.sourceLocationId
      ? { ...item, quarantineCount: item.quarantineCount + record.quantity, updatedAt: now } : item));
    const nextDeliveries: DeliveryRecord[] = deliveries.map(item => item.id === record.id ? { ...item, status: 'returned_for_review', returnedAt: now } : item);
    setDeliveries(nextDeliveries);
    setOrders(prev => prev.map(item => item.id === record.orderId ? { ...item, status: deliveryStatus(item, nextDeliveries) } : item));
    setMovements(prev => [{
      id: `mov-${crypto.randomUUID()}`,
      productId: record.productId,
      destLocationId: record.sourceLocationId,
      movementType: 'delivery_return_quarantine',
      quantity: record.quantity,
      referenceNo: record.id,
      reason: 'Failed delivery returned for inspection',
      createdBy: currentStaff.fullName,
      createdAt: now,
    }, ...prev]);
    addAudit('FAILED_DELIVERY_RECEIVED', 'deliveries', record.id, `${record.quantity} unit(s) placed in quarantine for inspection`);
  };

  // 7. Record Payment & Derive Balance
  const recordPayment = (data: { orderId: string; amount: number; paymentMethod: Payment['paymentMethod']; referenceNo: string; notes?: string }) => {
    if (!canPerform('record_payment')) throw new Error('Unauthorized to record payments.');
    if (!Number.isFinite(data.amount) || data.amount <= 0 || Math.abs(Math.round(data.amount * 100) - data.amount * 100) > 1e-6) {
      throw new Error('Payment amount must be positive and have no more than two decimals.');
    }

    const order = orders.find(o => o.id === data.orderId);
    if (!order) throw new Error('Order not found.');
    if (order.status === 'cancelled') throw new Error('Cancelled orders cannot receive payments.');
    if (data.amount > order.balanceDue) throw new Error(`Payment exceeds the ETB ${order.balanceDue.toLocaleString()} balance due.`);
    if (!data.referenceNo.trim()) throw new Error('Enter a payment reference.');
    if (payments.some(payment => payment.referenceNo.trim().toLowerCase() === data.referenceNo.trim().toLowerCase())) {
      throw new Error('This payment reference is already recorded.');
    }

    const newPaid = order.paidAmount + data.amount;
    const newBalance = Math.max(0, order.totalAmount - newPaid);
    const newStatus: SalesOrder['status'] = newPaid >= order.totalAmount ? 'paid' : 'partially_paid';

    setOrders(prev => prev.map(o => o.id === data.orderId ? {
      ...o,
      paidAmount: newPaid,
      balanceDue: newBalance,
      status: o.status === 'delivered' ? 'delivered' : newStatus,
    } : o));

    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      orderId: data.orderId,
      orderNumber: order.orderNumber,
      amount: data.amount,
      currency: 'ETB',
      paymentMethod: data.paymentMethod,
      referenceNo: data.referenceNo,
      notes: data.notes,
      recordedBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };
    setPayments(prev => [payment, ...prev]);

    addAudit('PAYMENT_RECORDED', 'payments', payment.id, `Recorded ETB ${data.amount.toLocaleString()} for ${order.orderNumber} via ${data.paymentMethod} (Ref: ${data.referenceNo})`);
  };

  const refundAndCancelOrder = (data: { orderId: string; reason: string; referenceNo: string }) => {
    if (!canPerform('approve_refund')) throw new Error('Only Finance can record a refund.');
    const order = orders.find(item => item.id === data.orderId);
    if (!order) throw new Error('An open order was not found.');
    if (!data.reason.trim() || !data.referenceNo.trim()) throw new Error('Enter the refund reason and transaction reference.');
    const now = new Date().toISOString();
    const plan = planFullRefund(order, payments, refunds, deliveries, balances, reservations, data.referenceNo, now);
    const refund: RefundRecord = {
      id: `ref-${crypto.randomUUID()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: plan.amount,
      referenceNo: data.referenceNo.trim(),
      reason: data.reason.trim(),
      recordedBy: currentStaff.fullName,
      createdAt: now,
    };
    setRefunds(prev => [refund, ...prev]);
    setReservations(plan.reservations);
    setBalances(plan.balances);
    setMovements(prev => [...plan.activeHolds.map(hold => ({
      id: `mov-${crypto.randomUUID()}`,
      productId: hold.productId,
      destLocationId: hold.locationId,
      movementType: 'reservation_release' as const,
      quantity: hold.quantity,
      referenceNo: refund.id,
      reason: 'Reservation released after Finance refund',
      createdBy: currentStaff.fullName,
      createdAt: now,
    })), ...prev]);
    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: 'cancelled', balanceDue: 0 } : item));
    addAudit('ORDER_REFUNDED_CANCELLED', 'sales_orders', order.id, `Finance refunded ETB ${plan.amount.toLocaleString()} for ${order.orderNumber}; reference ${refund.referenceNo}`);
  };

  // 8. Authorized Stock Adjustment (Manager/Admin Only)
  const recordAdjustment = (data: { productId: string; locationId: string; newQuantity: number; reason: string }) => {
    if (!canPerform('approve_adjustment')) throw new Error('Unauthorized: only managers and administrators can approve inventory adjustments.');
    if (data.newQuantity < 0) throw new Error('New count cannot be negative.');

    const b = balances.find(item => item.productId === data.productId && item.locationId === data.locationId);
    const oldQty = b ? b.sellableOnHand : 0;
    const activeHolds = b ? b.activeReserved : 0;

    if (data.newQuantity < activeHolds) {
      throw new Error(`New count (${data.newQuantity}) cannot be lower than active customer holds (${activeHolds}).`);
    }

    const delta = data.newQuantity - oldQty;

    setBalances(prev => {
      const now = new Date().toISOString();
      const idx = prev.findIndex(item => item.productId === data.productId && item.locationId === data.locationId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], sellableOnHand: data.newQuantity, updatedAt: now };
        return copy;
      } else {
        return [...prev, {
          productId: data.productId,
          locationId: data.locationId,
          sellableOnHand: data.newQuantity,
          activeReserved: 0,
          damagedCount: 0,
          quarantineCount: 0,
          updatedAt: now,
        }];
      }
    });

    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: data.productId,
      destLocationId: data.locationId,
      movementType: 'count_adjustment',
      quantity: Math.abs(delta),
      referenceNo: `ADJ-${Date.now().toString().slice(-6)}`,
      reason: `${data.reason} (count adjusted from ${oldQty} to ${data.newQuantity})`,
      createdBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };
    setMovements(prev => [mov, ...prev]);

    const prod = products.find(p => p.id === data.productId);
    const loc = locations.find(l => l.id === data.locationId);
    addAudit('STOCK_ADJUSTMENT', 'stock_balances', data.productId, `Stock adjusted for ${prod?.sku} at ${loc?.name}: ${oldQty} -> ${data.newQuantity} (Delta: ${delta >= 0 ? '+' : ''}${delta})`);
  };

  // 9. Create Exception Case (Returns, Damage, Warranty)
  const createException = (data: { caseType: ExceptionCase['caseType']; productId: string; locationId: string; quantity: number; disposition: ExceptionCase['disposition']; issueDescription: string; customerName?: string; orderNumber?: string }) => {
    if (!canPerform('manage_exceptions')) throw new Error('Unauthorized to log exceptions.');
    if (!Number.isSafeInteger(data.quantity) || data.quantity <= 0) throw new Error('Case quantity must be a positive whole number.');
    if (!data.issueDescription.trim()) throw new Error('Describe the issue before logging the case.');
    if (!products.some(product => product.id === data.productId) || !locations.some(location => location.id === data.locationId)) {
      throw new Error('Choose a valid product and area.');
    }

    const newCase: ExceptionCase = {
      id: `exc-${crypto.randomUUID()}`,
      caseNumber: `EXC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      caseType: data.caseType,
      productId: data.productId,
      locationId: data.locationId,
      quantity: data.quantity,
      disposition: data.disposition,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      issueDescription: data.issueDescription,
      recordedBy: currentStaff.fullName,
      createdAt: new Date().toISOString(),
    };

    setExceptions(prev => [newCase, ...prev]);

    addAudit('EXCEPTION_LOGGED', 'exception_cases', newCase.id, `Logged ${data.caseType} case ${newCase.caseNumber} for product ${data.productId} (${data.disposition}); stock unchanged pending authorized reconciliation`);
  };

  // 10. Catalogue Import with Dry-Run Validation
  const importCatalogueBatch = (newProducts: Product[]) => {
    if (!canPerform('import_catalogue')) throw new Error('Unauthorized to import official catalogue.');
    const preview = previewCatalogueImport(newProducts, products);
    if (preview.invalidRows > 0 || preview.blankSkus > 0 || preview.duplicates > 0) {
      throw new Error('The catalogue changed or contains invalid rows. Review the batch again before importing.');
    }
    if (preview.validProducts.length === 0) throw new Error('No valid products to import.');
    setProducts(prev => [...prev, ...preview.validProducts]);
    addAudit('CATALOGUE_IMPORTED', 'products', 'batch', `Imported ${preview.validProducts.length} demo catalogue items`);
    return { imported: preview.validProducts.length, duplicates: 0, blankSkus: 0 };
  };

  const resetToBaseline = () => {
    localStorage.removeItem(`${STORAGE_KEY}_products`);
    localStorage.removeItem(`${STORAGE_KEY}_balances`);
    localStorage.removeItem(`${STORAGE_KEY}_movements`);
    localStorage.removeItem(`${STORAGE_KEY}_orders`);
    localStorage.removeItem(`${STORAGE_KEY}_customers`);
    localStorage.removeItem(`${STORAGE_KEY}_reservations`);
    localStorage.removeItem(`${STORAGE_KEY}_payments`);
    localStorage.removeItem(`${STORAGE_KEY}_refunds`);
    localStorage.removeItem(`${STORAGE_KEY}_deliveries`);
    localStorage.removeItem(`${STORAGE_KEY}_exceptions`);
    localStorage.removeItem(`${STORAGE_KEY}_audit`);

    setProducts(INITIAL_PRODUCTS);
    setBalances(INITIAL_BALANCES);
    setMovements(INITIAL_MOVEMENTS);
    setOrders(INITIAL_ORDERS);
    setCustomers(INITIAL_CUSTOMERS);
    setReservations(INITIAL_RESERVATIONS);
    setPayments(INITIAL_PAYMENTS);
    setRefunds([]);
    setDeliveries([]);
    setExceptions(INITIAL_EXCEPTIONS);
    setAuditEvents(INITIAL_AUDIT);
    setCurrentStaff(INITIAL_STAFF[0]);
  };

  return (
    <ErpContext.Provider
      value={{
        staffList,
        currentStaff,
        setCurrentStaffRole,
        setCurrentStaff,
        locations,
        selectedLocationId,
        setSelectedLocationId,
        products,
        balances,
        movements,
        orders,
        customers,
        reservations,
        payments,
        refunds,
        deliveries,
        exceptions,
        auditEvents,
        canPerform,
        getProductStock,
        getPublicAvailabilityFeed,
        postReceipt,
        postTransfer,
        createOrder,
        createReservation,
        extendReservation,
        releaseReservation,
        dispatchOrderLine,
        confirmDelivery,
        failDelivery,
        receiveFailedDelivery,
        recordPayment,
        refundAndCancelOrder,
        recordAdjustment,
        createException,
        importCatalogueBatch,
        resetToBaseline,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
};

export const useErp = (): ErpContextType => {
  const context = useContext(ErpContext);
  if (!context) throw new Error('useErp must be used within an ErpProvider');
  return context;
};
