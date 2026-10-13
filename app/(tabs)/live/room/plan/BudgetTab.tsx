import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, DollarSign, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react-native';
import { usePlan } from '@/contexts/PlanContext';

const CATEGORIES = ['Equipment', 'Marketing', 'Team', 'Operations', 'Software', 'Venue', 'Travel', 'Other'];

export default function BudgetTab() {
  const { plan, addBudgetItem, updateBudgetItem, deleteBudgetItem, updatePlan } = usePlan();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [estCost, setEstCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [supplier, setSupplier] = useState('');

  const budget = plan?.budget;
  const items = budget?.items || [];

  const handleAdd = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addBudgetItem({
      name: name.trim(), category,
      estimatedCost: parseFloat(estCost) || 0,
      actualCost: parseFloat(actualCost) || 0,
      supplier: supplier.trim(),
    });
    setName(''); setCategory('Other'); setEstCost(''); setActualCost(''); setSupplier('');
    setShowForm(false);
  };

  const handleUpdateTotal = (field: string, value: string) => {
    const num = parseFloat(value) || 0;
    updatePlan({ budget: { ...(budget as any), [field]: num, items: budget?.items || [] } });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <DollarSign size={18} color="#10B981" />
          <Text style={styles.summaryValue}>${(budget?.total || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Budget</Text>
        </View>
        <View style={styles.summaryCard}>
          <TrendingDown size={18} color="#EF4444" />
          <Text style={styles.summaryValue}>${(budget?.actualCost || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Actual Cost</Text>
        </View>
        <View style={styles.summaryCard}>
          <Wallet size={18} color="#3B82F6" />
          <Text style={styles.summaryValue}>${(budget?.remaining || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
        <View style={styles.summaryCard}>
          <TrendingUp size={18} color="#8B5CF6" />
          <Text style={styles.summaryValue}>${(budget?.expectedRevenue || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Exp. Revenue</Text>
        </View>
      </View>

      {/* Quick Edit Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Budget</Text>
          <TextInput
            style={styles.totalInput}
            value={budget?.total?.toString() || '0'}
            onChangeText={v => handleUpdateTotal('total', v)}
            keyboardType="numeric"
            placeholderTextColor="#6B7280"
          />
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Expected Revenue</Text>
          <TextInput
            style={styles.totalInput}
            value={budget?.expectedRevenue?.toString() || '0'}
            onChangeText={v => handleUpdateTotal('expectedRevenue', v)}
            keyboardType="numeric"
            placeholderTextColor="#6B7280"
          />
        </View>
      </View>

      {/* Add Button */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Expense</Text>
        </TouchableOpacity>
      )}

      {/* Add Form */}
      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor="#6B7280"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, category === c && { backgroundColor: '#8B5CF6' }]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.catText, category === c && { color: '#FFF' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              value={estCost}
              onChangeText={setEstCost}
              placeholder="Est. Cost"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              value={actualCost}
              onChangeText={setActualCost}
              placeholder="Actual Cost"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
            />
          </View>
          <TextInput
            style={styles.formInput}
            value={supplier}
            onChangeText={setSupplier}
            placeholder="Supplier (optional)"
            placeholderTextColor="#6B7280"
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !name.trim() && { opacity: 0.5 }]}
              onPress={handleAdd}
            >
              <Text style={styles.submitText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Expense List */}
      {items.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <Receipt size={36} color="#4B5563" />
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptySub}>Track your budget by adding expenses</Text>
        </View>
      ) : (
        items.map(item => (
          <View key={item.id} style={styles.expenseCard}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseName}>{item.name}</Text>
              <View style={[styles.catBadge, { backgroundColor: '#374151' }]}>
                <Text style={styles.catBadgeText}>{item.category}</Text>
              </View>
            </View>
            <View style={styles.expenseRow}>
              <View style={styles.expenseCol}>
                <Text style={styles.expenseLabelSmall}>Est.</Text>
                <Text style={styles.expenseValueSmall}>${item.estimatedCost.toLocaleString()}</Text>
              </View>
              <View style={styles.expenseCol}>
                <Text style={styles.expenseLabelSmall}>Actual</Text>
                <Text style={[
                  styles.expenseValueSmall,
                  { color: item.actualCost > item.estimatedCost ? '#EF4444' : '#10B981' },
                ]}>
                  ${item.actualCost.toLocaleString()}
                </Text>
              </View>
              <View style={styles.expenseCol}>
                <Text style={styles.expenseLabelSmall}>Status</Text>
                <Text style={[
                  styles.expenseValueSmall,
                  { color: item.paymentStatus === 'paid' ? '#10B981' : item.paymentStatus === 'overdue' ? '#EF4444' : '#F59E0B' },
                ]}>
                  {item.paymentStatus}
                </Text>
              </View>
            </View>
            {item.supplier ? (
              <Text style={styles.supplierText}>Supplier: {item.supplier}</Text>
            ) : null}
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCard: {
    width: '47%', backgroundColor: '#1F2937', borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 6,
  },
  summaryValue: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  summaryLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '500' },
  // Totals
  totalsSection: { gap: 8, marginBottom: 12 },
  totalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1F2937', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10,
  },
  totalLabel: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },
  totalInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 14,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    width: 100, textAlign: 'right',
  },
  // Add
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, alignSelf: 'center',
    marginVertical: 8,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // Form
  formCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14, gap: 10,
    marginBottom: 10,
  },
  formInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 15,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  catScroll: { marginVertical: 2 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, backgroundColor: '#374151',
    marginRight: 6,
  },
  catText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#8B5CF6', paddingVertical: 8,
    paddingHorizontal: 20, borderRadius: 10,
  },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 13 },
  // Expense
  expenseCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    marginBottom: 8,
  },
  expenseHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  expenseName: { color: '#FFF', fontSize: 15, fontWeight: '600', flex: 1 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { color: '#9CA3AF', fontSize: 11, fontWeight: '500' },
  expenseRow: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  expenseCol: { gap: 2 },
  expenseLabelSmall: { color: '#6B7280', fontSize: 10, fontWeight: '600' },
  expenseValueSmall: { color: '#D1D5DB', fontSize: 14, fontWeight: '700' },
  supplierText: { color: '#6B7280', fontSize: 12, marginTop: 4 },
});
