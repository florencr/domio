# Translation Slugs Reference

Fill in `locales/al.json` with Albanian translations. Empty `""` values need translation. English in `locales/en.json` is the fallback.

Use the key path with `t("al", "key.path")` — e.g. `t("al", "common.loading")`.

## Slug list (copy the key, add Albanian value in al.json)

### common
- common.loading
- common.cancel
- common.save
- common.saveChanges
- common.delete
- common.edit
- common.close
- common.add
- common.create
- common.all
- common.or
- common.you
- common.owner
- common.action
- common.actions
- common.period
- common.status
- common.amount
- common.name
- common.unit
- common.units
- common.title
- common.description
- common.email
- common.phone
- common.role
- common.site
- common.sites
- common.config
- common.configuration
- common.preferences
- common.logout
- common.back
- common.noResults
- common.failed
- common.errorOccurred
- common.required
- common.optional
- common.toggleFilters
- common.selectPlaceholder
- common.searchPlaceholder
- common.month1 … common.month12

### auth
- auth.appTitle
- auth.signIn
- auth.signingIn
- auth.signUp
- auth.signingUp
- auth.signOut
- auth.signInToAccount
- auth.createAccount
- auth.dontHaveAccount
- auth.alreadyHaveAccount
- auth.dashboard
- auth.emailPlaceholder
- auth.password
- auth.savePassword
- auth.name
- auth.surname
- auth.phoneOptional
- auth.showPassword
- auth.hidePassword

### nav.manager
- nav.manager.billing, expenses, payments, ledger, config

### nav.owner
- nav.owner.myUnits, billing, payments, ledger, notifications

### nav.admin
- nav.admin.overview, managers, sites, buildings, users, audit, maintenance

### nav.config
- nav.config.buildings, units, unitTypes, services, expenses, vendors, categories, users, documents, notifications, audit

### preferences
- preferences.title, language, appLanguage, languageDescription, appearance, appearanceDescription, light, dark, system, english, shqip

### notifications
- notifications.billReady, billReadyBody (already translated)
- notifications.bellTitle, noNotifications, sendNewMessage, seeAllNotifications, sendMessageTitle, messageTitle, messagePlaceholder, messageBody, messageBodyPlaceholder, sendTo, ownersOnly, tenantsOnly, ownersAndTenants, filterByUnitType, unpaidOnly, enterTitle, sentToRecipients, failedToSend

### manager
- manager.manager, collected, collectedFrom, outstanding, outstandingFrom, monthlyExpenses, expenseRecords, netFund, collectedMinusExpenses
- manager.generate, generateBills, deleteBillsPeriod, sendOverdueReminders, descriptionPlaceholder, ratePerM2, amountEur
- manager.markPaid, markUnpaid, onceOff, recurrent
- manager.noBillsMatchFilters, noBillsYet, billsAlreadyGenerated, noBuildings, validMonthYearRequired

### configBuildings
- configBuildings.* (see al.json for full list)

### configUnits
- configUnits.*

### configServices
- configServices.*

### configExpenses
- configExpenses.*

### configVendors
- configVendors.vendors

### configCategories
- configCategories.*

### owner
- owner.*

### tenant
- tenant.*

### admin
- admin.*

### payments, ledger
- payments.payments, ledger.ledger

---

**Params in strings:** Use `{paramName}` in the translation. Example: `sentToRecipients` = "Sent to {count} recipients" → "Dërguar te {count} marrës".
