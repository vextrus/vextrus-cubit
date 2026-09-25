# The frontend is a React SPA on generated OpenAPI types, with our own viewers

- **The app:** React 19 + TypeScript + Vite, running in the browser only. TanStack Router and
  Query, React Hook Form + Zod, and Tailwind v4 design tokens with shadcn/ui components copied into
  the app.
- **The API contract:** it talks to the Django API through TypeScript types generated from its
  OpenAPI schema (openapi-typescript and openapi-fetch). The generated file is never committed.
- **The BOQ grid:** TanStack Table and Virtual, in one module we own. AG Grid Enterprise is the
  fallback if keyboard and paste behaviour takes more than a few days.
- **Sheets:** dxf-viewer for DWG-derived sheets, pdf.js for vector PDFs, and our own Trace overlay.
- **The Building Model:** plain Three.js over a GLB the backend builds, one node per element id, so
  Proposals show and elements recolour on Confirmation. That Open is kept for viewing clients' own IFC.
- **Documents:** built on the server, XlsxWriter for Excel and WeasyPrint for PDF, with a Bengali
  font embedded so ৳ renders.
- **Money:** lakh grouping through `en-IN`, never `en-BD`. Screen, Excel and PDF are checked against
  one shared table of expected formats.

Web only. Rejected:
- Next.js: a second server in front of Python.
- tRPC: it needs a TypeScript server.
- GraphQL codegen: the old ERP's pain.
- A separate design-system package and Electron: the old ERP again.
- xeokit: AGPL.

The stack alone will not make the UI good; OpenConstructionERP runs almost this stack. Quality comes
from practice: tokens first, visual review in a real browser, keyboard tests.
Details: docs/research/stack-frontend.md.
