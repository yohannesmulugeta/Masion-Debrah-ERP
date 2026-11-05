# Maison Debrah Ethiopia — Website Availability Integration Specification

Target Public Website: `https://et.maisondebrah.com` (previewing at staging repo `C:\Users\hp\Documents\ChatGPT\Maisondebrah Ethiopia staging website`)

**Status:** proposed integration only. The current ERP and website have no verified live connection. Review the database view, access grants, SKU mapping, and approved stock before implementation.

---

## 1. Core Principles & Boundaries

1. **Information Isolation:** The public website NEVER connects with the Supabase service-role secret key. It only uses the public anonymous key (`VITE_SUPABASE_ANON_KEY`).
2. **Data Model Boundary:** The proposed public website must not query tables `stock_balances`, `customers`, `sales_orders`, `payments`, or `staff_profiles`. The draft PostgreSQL view exposes SKU, product catalogue metadata (name, collection, category, image URL, dimensions, materials), and a derived availability status. Approve every public field before connecting the website:
   ```sql
   SELECT * FROM v_public_product_availability WHERE sku = :sku;
   ```
3. **Availability Status Values:**
   - `'in_stock'`: Positive unreserved sellable stock exists in an area approved for customer availability.
     - Brand Display Label: **Available in Ethiopia**
     - Subtext: *In stock for immediate showroom viewing and regional dispatch.*
   - `'available_to_order'`: Zero unreserved sellable local stock.
     - Brand Display Label: **Ask about ordering**
     - Subtext: *Not currently in local stock. Inquire with our consultants for made-to-order delivery.*
   - Network / Query Error:
     - Fallback Label: **Check availability** (neutral wording; never assert stock when lookup fails).

---

## 2. Integration Implementation in Staging Website

In the website codebase (`Maisondebrah Ethiopia staging website`):

### A. Environment Configuration (`.env`)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi... # Public anonymous key only
```

### B. Client Helper (`src/lib/availability.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export async function getProductAvailability(sku: string): Promise<{
  status: 'in_stock' | 'available_to_order' | 'error';
  label: string;
}> {
  if (!supabase || !sku) {
    return { status: 'error', label: 'Check availability' };
  }

  try {
    const { data, error } = await supabase
      .from('v_public_product_availability')
      .select('availability_status')
      .eq('sku', sku)
      .maybeSingle();

    if (error || !data) {
      return { status: 'error', label: 'Check availability' };
    }

    if (data.availability_status === 'in_stock') {
      return { status: 'in_stock', label: 'Available in Ethiopia' };
    }

    return { status: 'available_to_order', label: 'Ask about ordering' };
  } catch {
    return { status: 'error', label: 'Check availability' };
  }
}
```

### C. UI Component Integration (`src/App.tsx` product card / detail)
```tsx
const [availability, setAvailability] = useState<{ status: string; label: string } | null>(null);

useEffect(() => {
  if (product?.sku) {
    getProductAvailability(product.sku).then(setAvailability);
  }
}, [product?.sku]);

return (
  <div className="availability-badge">
    {availability?.status === 'in_stock' ? (
      <span className="badge badge-in-stock">● Available in Ethiopia</span>
    ) : availability?.status === 'available_to_order' ? (
      <span className="badge badge-order-only">○ Ask about ordering</span>
    ) : (
      <span className="badge badge-neutral">Check availability</span>
    )}
  </div>
);
```
