# Product Requirements Document: Cominsula.io MVP

## Executive Summary

**Product:** Cominsula.io  
**Mission:** Central command for property management  
**Version:** MVP (1.0)  
**Document Status:** Final  
**Last Updated:** 2026-02-04  

### Product Vision
Cominsula.io is a global, multi-tenant property management platform designed to act as the central operational command for property managers. It enables structured management of properties, tenants, payments, notices, and public listings while remaining jurisdiction-neutral and scalable across major real estate markets. The platform prioritizes professional-grade workflows, legal traceability, and operational clarity.

### Success Criteria
- Property manager onboarding completed in < 15 minutes
- ≥ 99% accuracy in rent ledger calculations
- Automated overdue detection functioning without manual intervention
- Tenant notice delivery success rate ≥ 99%
- Platform ready for US and UAE markets at launch

---

## Problem Statement

### Problem Definition
Property managers globally face operational overload due to fragmented tools, manual tenant handling, mixed payment channels, and lack of structured legal notice workflows. These problems scale poorly as portfolios grow and are amplified in international and immigrant-heavy tenant environments.

### Impact Analysis
- **User Impact:** Reduced burnout, fewer disputes, improved payment compliance
- **Market Impact:** Large, underserved mid-market property managers in US & UAE
- **Business Impact:** Subscription-driven SaaS with strong expansion potential

---

## Target Audience

### Primary Persona: Property Manager
**Demographics:**
- Age: 28–55
- Location: US, UAE (initial)
- Income: Mid to high income
- Portfolio Size: 5–500 units

**Psychographics:**
- Detail-oriented
- Risk-averse
- Time-constrained
- Prefers structured, professional tools

**Jobs to Be Done:**
1. Manage multiple properties efficiently
2. Enforce payment discipline without constant follow-ups
3. Maintain legal and financial records defensibly

**Current Solutions & Pain Points:**

| Current Solution | Pain Points | Our Advantage |
|------------------|------------|---------------|
| Excel + WhatsApp | Error-prone, informal | Structured, auditable system |
| Generic CRMs | Not real-estate specific | Property-first data model |
| Manual notices | Legal risk | Logged, traceable notices |

### Secondary Personas
- Tenant (invited user)
- Public visitor (browsing only)

---

## User Stories

### Epic: Property & Tenant Lifecycle Management

**Primary User Story:**  
"As a property manager, I want to manage properties, tenants, payments, and notices in one system so that I can operate professionally and at scale."

**Acceptance Criteria:**
- [ ] Manager can create properties and units
- [ ] Manager can invite tenants
- [ ] Manager can issue formal notices

### Supporting User Stories

1. "As a tenant, I want to see my rent status and notices so that I know my obligations."
   - AC: Tenant dashboard shows balance, due date, notices

2. "As a manager, I want overdue tenants flagged automatically so I can act early."
   - AC: 96-hour escalation rule enforced

3. "As a public user, I want to browse available properties without creating an account."
   - AC: Listings visible anonymously

---

## Functional Requirements

### Core Features (MVP — P0)

#### Feature 1: Property Manager Accounts
- **Description:** Only property managers can create accounts
- **User Value:** Centralized control
- **Business Value:** Clear customer definition
- **Acceptance Criteria:**
  - [ ] Supabase email/password auth
  - [ ] Role stored in user metadata
- **Dependencies:** Supabase Auth
- **Estimated Effort:** M

---

#### Feature 2: Property & Unit Management
- **Description:** Managers can create properties and units
- **User Value:** Portfolio visibility
- **Business Value:** Scalable data model
- **Acceptance Criteria:**
  - [ ] Properties linked to manager
  - [ ] Units track occupancy state
- **Dependencies:** Supabase DB
- **Estimated Effort:** M
-**Analytics**: analytics that you could make a professional report from

---

#### Feature 3: Tenant Invitation & Lifecycle
- **Description:** Tenants are invited and bound to a unit
- **User Value:** Controlled access
- **Business Value:** Security & compliance
- **Acceptance Criteria:**
  - [ ] Invite via email
  - [ ] Tenant must set password
  - [ ] Removal deletes tenant account
  - [ ] Removed tenant gets `401 Unauthorized`
- **Dependencies:** Supabase Auth + RLS
- **Estimated Effort:** L

---

#### Feature 4: Payment Tracking & Enforcement
- **Description:** Track rent via cash and digital payments
- **User Value:** Financial clarity
- **Business Value:** Reduced defaults
- **Acceptance Criteria:**
  - [ ] Stripe integration
  - [ ] Mobile Money integration
  - [ ] Due date visible to tenant
  - [ ] Non-closable overdue notice on due date
  - [ ] Red escalation notice after 96 hours
  - [ ] Manager notified on escalation
- **Dependencies:** Payment APIs
- **Estimated Effort:** L

---

#### Feature 5: Tenant Notice & Eviction System
- **Description:** Formal, jurisdiction-neutral notices
- **User Value:** Clear communication
- **Business Value:** Legal defensibility
- **Acceptance Criteria:**
  - [ ] Manager drafts notice text
  - [ ] Notice labeled "Formal, Jurisdiction-Neutral"
  - [ ] Delivered to tenant
  - [ ] Stored permanently
- **Dependencies:** File storage
- **Estimated Effort:** M

---

#### Feature 6: Public Property Listings
- **Description:** Anonymous browsing of vacant properties
- **User Value:** Discovery
- **Business Value:** Lead funnel
- **Acceptance Criteria:**
  - [ ] Sort by location
  - [ ] Sort by size
  - [ ] Sort by rating
- **Dependencies:** Public API
- **Estimated Effort:** M

---

### Should Have (P1)
- Maintenance requests
- Manager staff roles
- Lease document uploads

### Could Have (P2)
- Tax automation
- AI tenant assistant
- Multi-language UI

### Out of Scope (Won't Have)
- Court integrations (legal complexity)
- Automated evictions (jurisdiction risk)

---

## Non-Functional Requirements

### Performance
- Page Load: < 2s (p95)
- API Response: < 200ms (p95)
- Concurrent Users: 1,000
- Uptime: 99.9%

### Security
- Authentication: Supabase Auth
- Authorization: Strict RLS
- Data Protection: AES-256 at rest
- Compliance: GDPR-ready

### Usability
- Accessibility: WCAG 2.1 AA
- Browser Support: Latest 2 versions
- Mobile Support: Responsive
- Internationalization: Future-ready

### Scalability
- 10x user growth without re-architecture
- Region expansion supported
- Multi-tenant isolation enforced

---

## Quality Standards (Anti-Vibe Rules)

### Code Quality Requirements
- Strict TypeScript
- No business logic in controllers
- Explicit error handling
- Minimum 80% test coverage

### Design Quality Requirements
- Font: Century Gothic (mandatory)
- Professional tone only
- No experimental UI patterns
- Card & component styling: TBD (Owner Review)

### What This Project Will NOT Accept
- Informal UI
- Hardcoded regions
- Weak auth boundaries
- Silent failures

---

## UI/UX Requirements

### Design Principles
1. Professional-first: system must feel authoritative
2. Clarity over aesthetics
3. Auditability over convenience

### Landing page

### Information Architecture
- Manager Dashboard
- Property View
- Unit View
- Tenant Profile
- Payment Ledger
- Notice Center
- Public Listings

## Account Structure, Tenant Isolation & Subscription Constraints

### Relationship Model (Hard Rule)
- All tenant relationships are mediated **only through a Property Manager**
- Tenants are **never connected to other tenants**
- A tenant belongs to **exactly one unit**, under **exactly one property**
- Removing a tenant fully revokes platform access


---

### Subscription Plans (MVP Enforcement)

#### Free Tier
- Properties allowed: **1**
- Maximum tenants per property: **5**
- Intended for small landlords / trial usage

#### Standard Tier
- Properties allowed: **Up to 5**
- Maximum tenants per property: **15**
- Intended for growing property managers

#### Premium Tier
- Properties allowed: **Unlimited**
- Maximum tenants per property: **30**
- Intended for professional / enterprise managers

---

### Tenant Capacity Enforcement Rules

- Tenant limits apply **per property**, not globally
- Attempting to exceed limits must:
  - Block the action
  - Display upgrade prompt
- Enforcement applies to:
  - Tenant invitations
  - Unit assignments

---

### Property Creation Constraints

- Property Managers:
  - Can create properties only within their subscription limits
  - Cannot bypass limits via API or direct DB writes

---

### Functional Requirements (MVP — P0)

#### Feature: Subscription-Aware Property & Tenant Limits

- **Description:** Enforce plan-based limits on property and tenant creation
- **User Value:** Predictable, fair usage
- **Business Value:** Monetization control
- **Acceptance Criteria:**
  - [ ] Free tier blocked after 1 property
  - [ ] Tenant invite blocked when limit reached
  - [ ] Clear upgrade messaging shown
  - [ ] Tenant deletion frees capacity
- **Dependencies:** Subscription plan table
- **Estimated Effort:** M

---

### Non-Functional Constraints

- Limits must be enforced at:
  - UI level (prevent action)
  - API level (reject request)
  - Database level (guard rails)
- No soft limits allowed in MVP

---

### Out of Scope (Explicit)
- Tenant-to-tenant messaging
- Shared tenant accounts across properties
- Tenant self-registration

---

### Implementation Notes (MVP)

- Subscription tier stored on property manager profile
- Limits checked before:
  - Property creation
  - Tenant invitation
- Supabase RLS and DB constraints must prevent over-allocation
- Plan upgrades take effect immediately

---

### Future Expansion (Not MVP)
- Dynamic pricing rules
- Per-unit pricing
- Usage analytics per manager
- Plan downgrades with grace periods


