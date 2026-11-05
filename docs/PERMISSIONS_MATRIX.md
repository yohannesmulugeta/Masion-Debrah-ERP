# Maison Debrah ERP — proposed staff permission matrix

The UI role selector is a prototype control, not real staff sign-in. Database read policies require an active staff profile; operational client writes and unverified functions are restricted. The table below describes the **intended** role design and needs business approval and server-side implementation before live use.

| Operation | Admin | Manager | Stock Clerk | Sales | Finance |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Approve catalogue import | Yes | Yes | No | No | No |
| Post goods receipt | Yes | Yes | Yes | No | No |
| Move stock between rooms | Yes | Yes | Yes | No | No |
| Approve stock adjustment | Yes | Yes | No | No | No |
| Create customer and order | Yes | Yes | No | Yes | No |
| Create or release hold | Yes | Yes | No | Yes | No |
| Fulfil order | Yes | Yes | Yes | No | No |
| Record payment | Yes | No | No | Yes | Yes |
| Approve refund | Yes | No | No | No | Yes |
| Log damage or return case | Yes | Yes | Yes | No | No |
| View full audit trail | Yes | Yes | No | No | No |

Public website availability is a separate, limited read interface. It must be independently reviewed and tested before connection to the website.
