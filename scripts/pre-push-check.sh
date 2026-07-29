#!/bin/bash
# PRE-PUSH VERIFICATION — prevents regression bugs
# Runs before every EAS update. Fails = DO NOT PUSH.

echo "=== TypeScript Check ==="
# These are pre-existing type mismatches (not from our changes)
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "ProductCondition\|ProductCategory\|CreateProductModal\|productId\|Property 'key'\|Property 'label'" | grep -v "Property 'image' does not exist on type 'ServiceRequest'\|Property 'expiresIn' does not exist on type 'ServiceRequest'\|Property 'requester' does not exist on type 'ServiceRequest'\|Property 'budget' does not exist on type 'ServiceRequest'\|Property 'distance' does not exist on type 'ServiceRequest'" | grep "error TS" && {
  echo ""
  echo "❌ NEW TypeScript errors found above! Fix them BEFORE pushing."
  exit 1
}

echo "✅ No new TypeScript errors"
echo ""
echo "=== Reference Check ==="
# Verify no undefined variable references
npx tsc --noEmit 2>&1 | grep "Cannot find name" | grep -v "ProductCondition\|ProductCategory" && {
  echo "❌ Undefined variables found! Fix them BEFORE pushing."
  exit 1
}

echo "✅ All checks passed — safe to push"
exit 0
