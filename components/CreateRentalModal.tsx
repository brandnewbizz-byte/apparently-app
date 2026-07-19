import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Switch,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Camera,
  Home,
  Car,
  Ship,
  ChevronRight,
  Check,
  MapPin,
  DollarSign,
  Info,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/contexts/ThemeContext';
import { useBookings, type RentalSubmissionInput, type ListingCategory } from '@/contexts/BookingsContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  CAR_TYPES,
  CAR_FUEL_TYPES,
  CAR_TRANSMISSIONS,
  PROPERTY_TYPES,
  BOAT_TYPES,
  CANCELLATION_POLICIES,
} from '@/mocks/bookingsData';

interface CreateRentalModalProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'category' | 'details' | 'specs' | 'amenities' | 'pricing' | 'rules' | 'review';

const STEPS: Step[] = ['category', 'details', 'specs', 'amenities', 'pricing', 'rules', 'review'];



export default function CreateRentalModal({ visible, onClose }: CreateRentalModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { submitRental, getAmenitiesForCategory } = useBookings();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('category');
  const [category, setCategory] = useState<ListingCategory | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [instantBook, setInstantBook] = useState(false);
  const [cancellationPolicy, setCancellationPolicy] = useState<'flexible' | 'moderate' | 'strict'>('moderate');
  
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carType, setCarType] = useState('');
  const [carSeats, setCarSeats] = useState('');
  const [carFuelType, setCarFuelType] = useState('');
  const [carTransmission, setCarTransmission] = useState('');
  const [carMileage, setCarMileage] = useState('');
  
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [maxGuests, setMaxGuests] = useState('');
  const [beds, setBeds] = useState('');
  
  const [boatType, setBoatType] = useState('');
  const [boatLength, setBoatLength] = useState('');
  const [boatCapacity, setBoatCapacity] = useState('');
  const [boatCabins, setBoatCabins] = useState('');
  const [captainIncluded, setCaptainIncluded] = useState(false);
  const [requiresLicense, setRequiresLicense] = useState(false);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const amenitiesForCategory = useMemo(() => {
    if (!category) return [];
    return getAmenitiesForCategory(category);
  }, [category, getAmenitiesForCategory]);

  const resetForm = useCallback(() => {
    setCurrentStep('category');
    setCategory(null);
    setTitle('');
    setDescription('');
    setImages([]);
    setLocation('');
    setPricePerDay('');
    setPricePerHour('');
    setInstantBook(false);
    setCancellationPolicy('moderate');
    setSelectedAmenities([]);
    setRules([]);
    setNewRule('');
    setCarMake('');
    setCarModel('');
    setCarYear('');
    setCarType('');
    setCarSeats('');
    setCarFuelType('');
    setCarTransmission('');
    setCarMileage('');
    setPropertyType('');
    setBedrooms('');
    setBathrooms('');
    setMaxGuests('');
    setBeds('');
    setBoatType('');
    setBoatLength('');
    setBoatCapacity('');
    setBoatCabins('');
    setCaptainIncluded(false);
    setRequiresLicense(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - images.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 10));
      }
    } catch (error) {
      console.error('[CreateRentalModal] Error picking image:', error);
    }
  }, [images.length]);

  const handleRemoveImage = useCallback((index: number) => {
    onPressHaptic();
    setImages(prev => prev.filter((_, i) => i !== index));
  }, [onPressHaptic]);

  const handleToggleAmenity = useCallback((amenityId: string) => {
    onPressHaptic();
    setSelectedAmenities(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  }, [onPressHaptic]);

  const handleAddRule = useCallback(() => {
    if (newRule.trim()) {
      setRules(prev => [...prev, newRule.trim()]);
      setNewRule('');
    }
  }, [newRule]);

  const handleRemoveRule = useCallback((index: number) => {
    onPressHaptic();
    setRules(prev => prev.filter((_, i) => i !== index));
  }, [onPressHaptic]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'category':
        return category !== null;
      case 'details':
        return title.trim().length >= 5 && description.trim().length >= 20 && location.trim().length >= 3;
      case 'specs':
        if (category === 'car') {
          return carMake.trim() && carModel.trim() && carYear && carType;
        } else if (category === 'stay') {
          return propertyType && bedrooms && bathrooms && maxGuests;
        } else if (category === 'boat') {
          return boatType && boatLength && boatCapacity;
        }
        return true;
      case 'amenities':
        return true;
      case 'pricing':
        return parseFloat(pricePerDay) > 0;
      case 'rules':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, category, title, description, location, carMake, carModel, carYear, carType, propertyType, bedrooms, bathrooms, maxGuests, boatType, boatLength, boatCapacity, pricePerDay]);

  const handleNext = useCallback(() => {
    onPressHaptic();
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1]);
    }
  }, [currentStep, onPressHaptic]);

  const handleBack = useCallback(() => {
    onPressHaptic();
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]);
    }
  }, [currentStep, onPressHaptic]);

  const buildSpecs = useCallback((): Record<string, string> => {
    if (category === 'car') {
      return {
        'Make': carMake,
        'Model': carModel,
        'Year': carYear,
        'Type': carType,
        'Seats': carSeats || 'N/A',
        'Fuel': carFuelType || 'N/A',
        'Transmission': carTransmission || 'N/A',
        'Mileage': carMileage ? `${carMileage} miles` : 'N/A',
      };
    } else if (category === 'stay') {
      return {
        'Property Type': propertyType,
        'Bedrooms': bedrooms,
        'Bathrooms': bathrooms,
        'Max Guests': maxGuests,
        'Beds': beds || 'N/A',
      };
    } else if (category === 'boat') {
      return {
        'Type': boatType,
        'Length': `${boatLength} ft`,
        'Capacity': `${boatCapacity} guests`,
        'Cabins': boatCabins || '0',
        'Captain': captainIncluded ? 'Included' : 'Not included',
        'License Required': requiresLicense ? 'Yes' : 'No',
      };
    }
    return {};
  }, [category, carMake, carModel, carYear, carType, carSeats, carFuelType, carTransmission, carMileage, propertyType, bedrooms, bathrooms, maxGuests, beds, boatType, boatLength, boatCapacity, boatCabins, captainIncluded, requiresLicense]);

  const handleSubmit = useCallback(() => {
    onPressHaptic();
    
    if (!category) return;

    if (images.length < 1) {
      Alert.alert(
        'Photos Required',
        'Please add at least one photo of your listing before submitting. Go back to the Details step to add photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const submission: RentalSubmissionInput = {
      category,
      title: title.trim(),
      description: description.trim(),
      images,
      ownerId: user?.id || '',
      ownerName: user?.fullName || 'You',
      ownerAvatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      location: location.trim(),
      pricePerDay: parseFloat(pricePerDay) || 0,
      pricePerHour: pricePerHour ? parseFloat(pricePerHour) : undefined,
      currency: 'USD',
      amenityIds: selectedAmenities,
      specs: buildSpecs(),
      rules,
      cancellationPolicy,
      instantBook,
      carMake: category === 'car' ? carMake : undefined,
      carModel: category === 'car' ? carModel : undefined,
      carYear: category === 'car' ? parseInt(carYear) : undefined,
      carType: category === 'car' ? carType : undefined,
      carSeats: category === 'car' ? parseInt(carSeats) : undefined,
      carFuelType: category === 'car' ? carFuelType : undefined,
      carTransmission: category === 'car' ? carTransmission : undefined,
      carMileage: category === 'car' && carMileage ? parseInt(carMileage) : undefined,
      propertyType: category === 'stay' ? propertyType : undefined,
      bedrooms: category === 'stay' ? parseInt(bedrooms) : undefined,
      bathrooms: category === 'stay' ? parseFloat(bathrooms) : undefined,
      maxGuests: category === 'stay' ? parseInt(maxGuests) : undefined,
      beds: category === 'stay' ? beds : undefined,
      boatType: category === 'boat' ? boatType : undefined,
      boatLength: category === 'boat' ? parseInt(boatLength) : undefined,
      boatCapacity: category === 'boat' ? parseInt(boatCapacity) : undefined,
      boatCabins: category === 'boat' && boatCabins ? parseInt(boatCabins) : undefined,
      captainIncluded: category === 'boat' ? captainIncluded : undefined,
      requiresLicense: category === 'boat' ? requiresLicense : undefined,
    };

    submitRental(submission);
    
    Alert.alert(
      'Submission Received',
      'Your rental has been submitted for review. Our moderators will review it within 24-48 hours.',
      [{ text: 'OK', onPress: handleClose }]
    );
  }, [category, title, description, images, location, pricePerDay, pricePerHour, selectedAmenities, rules, cancellationPolicy, instantBook, carMake, carModel, carYear, carType, carSeats, carFuelType, carTransmission, carMileage, propertyType, bedrooms, bathrooms, maxGuests, beds, boatType, boatLength, boatCapacity, boatCabins, captainIncluded, requiresLicense, submitRental, buildSpecs, handleClose, onPressHaptic, user?.id, user?.fullName, user?.avatar]);

  const renderCategoryStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>What would you like to list?</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Select the type of rental you want to submit
      </Text>

      <View style={styles.categoryGrid}>
        {[
          { key: 'stay' as const, label: 'Home / Stay', icon: Home, desc: 'House, apartment, villa, etc.' },
          { key: 'car' as const, label: 'Car / Vehicle', icon: Car, desc: 'Cars, SUVs, trucks, etc.' },
          { key: 'boat' as const, label: 'Boat / Watercraft', icon: Ship, desc: 'Yachts, boats, jet skis, etc.' },
        ].map((item) => {
          const isSelected = category === item.key;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.backgroundSecondary, borderColor: isSelected ? colors.accent : colors.border },
                isSelected && { borderWidth: 2 },
              ]}
              onPress={() => {
                onPressHaptic();
                setCategory(item.key);
                setSelectedAmenities([]);
              }}
              testID={`category_${item.key}`}
            >
              <View style={[styles.categoryIconWrap, { backgroundColor: isSelected ? colors.accent : colors.border }]}>
                <Icon size={28} color={isSelected ? '#fff' : colors.textSecondary} />
              </View>
              <Text style={[styles.categoryLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                  <Check size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const isTitleValid = title.trim().length >= 5;
  const isDescriptionValid = description.trim().length >= 20;
  const isLocationValid = location.trim().length >= 3;

  const renderDetailsStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>Basic Information</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Tell us about your {category === 'stay' ? 'property' : category === 'car' ? 'vehicle' : 'boat'}
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Title *</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              backgroundColor: colors.backgroundSecondary, 
              color: colors.text, 
              borderColor: title.length > 0 && !isTitleValid ? colors.error : colors.border 
            }
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder={category === 'car' ? 'e.g. 2023 Tesla Model 3' : category === 'boat' ? 'e.g. 42ft Luxury Yacht' : 'e.g. Modern Downtown Loft'}
          placeholderTextColor={colors.textTertiary}
          testID="rentalTitle"
        />
        <Text style={[styles.inputHint, { color: isTitleValid ? colors.success : colors.textTertiary }]}>
          {isTitleValid ? '✓ ' : ''}Minimum 5 characters ({title.trim().length}/5)
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Description *</Text>
        <TextInput
          style={[
            styles.textArea, 
            { 
              backgroundColor: colors.backgroundSecondary, 
              color: colors.text, 
              borderColor: description.length > 0 && !isDescriptionValid ? colors.error : colors.border 
            }
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your listing in detail..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          testID="rentalDescription"
        />
        <Text style={[styles.inputHint, { color: isDescriptionValid ? colors.success : colors.textTertiary }]}>
          {isDescriptionValid ? '✓ ' : ''}Minimum 20 characters ({description.trim().length}/20)
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Location *</Text>
        <View style={[
          styles.inputWithIcon, 
          { 
            backgroundColor: colors.backgroundSecondary, 
            borderColor: location.length > 0 && !isLocationValid ? colors.error : colors.border 
          }
        ]}>
          <MapPin size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.inputInner, { color: colors.text }]}
            value={location}
            onChangeText={setLocation}
            placeholder="City, State or Address"
            placeholderTextColor={colors.textTertiary}
            testID="rentalLocation"
          />
        </View>
        <Text style={[styles.inputHint, { color: isLocationValid ? colors.success : colors.textTertiary, marginTop: 6 }]}>
          {isLocationValid ? '✓ ' : ''}Minimum 3 characters
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Photos (optional now, required before submit)</Text>
        <Text style={[styles.inputHint, { color: colors.textTertiary, marginBottom: 10 }]}>Add up to 10 photos.</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          <TouchableOpacity
            style={[styles.addImageButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={handlePickImage}
            testID="addRentalImage"
          >
            <Camera size={24} color={colors.textSecondary} />
            <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add Photos</Text>
          </TouchableOpacity>
          
          {images.map((uri, index) => (
            <View key={index} style={styles.imagePreviewWrap}>
              <Image source={{ uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                onPress={() => handleRemoveImage(index)}
              >
                <X size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );

  const renderSpecsStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {category === 'car' ? 'Vehicle Details' : category === 'boat' ? 'Boat Details' : 'Property Details'}
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Provide specific details about your {category === 'stay' ? 'property' : category === 'car' ? 'vehicle' : 'boat'}
      </Text>

      {category === 'car' && (
        <>
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Make *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={carMake}
                onChangeText={setCarMake}
                placeholder="e.g. Tesla"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Model *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={carModel}
                onChangeText={setCarModel}
                placeholder="e.g. Model 3"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Year *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={carYear}
                onChangeText={setCarYear}
                placeholder="2024"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Seats</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={carSeats}
                onChangeText={setCarSeats}
                placeholder="5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Vehicle Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CAR_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: carType === type ? colors.accent : colors.backgroundSecondary, borderColor: carType === type ? colors.accent : colors.border },
                    ]}
                    onPress={() => setCarType(type)}
                  >
                    <Text style={[styles.chipText, { color: carType === type ? '#fff' : colors.text }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Fuel Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CAR_FUEL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: carFuelType === type ? colors.accent : colors.backgroundSecondary, borderColor: carFuelType === type ? colors.accent : colors.border },
                    ]}
                    onPress={() => setCarFuelType(type)}
                  >
                    <Text style={[styles.chipText, { color: carFuelType === type ? '#fff' : colors.text }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Transmission</Text>
            <View style={styles.chipRow}>
              {CAR_TRANSMISSIONS.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    { backgroundColor: carTransmission === type ? colors.accent : colors.backgroundSecondary, borderColor: carTransmission === type ? colors.accent : colors.border },
                  ]}
                  onPress={() => setCarTransmission(type)}
                >
                  <Text style={[styles.chipText, { color: carTransmission === type ? '#fff' : colors.text }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Mileage</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              value={carMileage}
              onChangeText={setCarMileage}
              placeholder="e.g. 15000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
        </>
      )}

      {category === 'stay' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Property Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {PROPERTY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: propertyType === type ? colors.accent : colors.backgroundSecondary, borderColor: propertyType === type ? colors.accent : colors.border },
                    ]}
                    onPress={() => setPropertyType(type)}
                  >
                    <Text style={[styles.chipText, { color: propertyType === type ? '#fff' : colors.text }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Bedrooms *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={bedrooms}
                onChangeText={setBedrooms}
                placeholder="2"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Bathrooms *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={bathrooms}
                onChangeText={setBathrooms}
                placeholder="1.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Max Guests *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={maxGuests}
                onChangeText={setMaxGuests}
                placeholder="4"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Beds</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={beds}
                onChangeText={setBeds}
                placeholder="1 King, 2 Twin"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        </>
      )}

      {category === 'boat' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Boat Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {BOAT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: boatType === type ? colors.accent : colors.backgroundSecondary, borderColor: boatType === type ? colors.accent : colors.border },
                    ]}
                    onPress={() => setBoatType(type)}
                  >
                    <Text style={[styles.chipText, { color: boatType === type ? '#fff' : colors.text }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Length (ft) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={boatLength}
                onChangeText={setBoatLength}
                placeholder="42"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Capacity *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={boatCapacity}
                onChangeText={setBoatCapacity}
                placeholder="12"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Cabins</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              value={boatCabins}
              onChangeText={setBoatCabins}
              placeholder="2"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>

          <View style={[styles.toggleRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Captain Included</Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>A licensed captain comes with the rental</Text>
            </View>
            <Switch
              value={captainIncluded}
              onValueChange={setCaptainIncluded}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.toggleRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>License Required</Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>Renter needs a boating license to operate</Text>
            </View>
            <Switch
              value={requiresLicense}
              onValueChange={setRequiresLicense}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderAmenitiesStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>Amenities & Features</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Select all the amenities and features included
      </Text>

      <View style={styles.amenitiesGrid}>
        {amenitiesForCategory.map((amenity) => {
          const isSelected = selectedAmenities.includes(amenity.id);
          return (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.amenityItem,
                { backgroundColor: colors.backgroundSecondary, borderColor: isSelected ? colors.accent : colors.border },
                isSelected && { borderWidth: 2 },
              ]}
              onPress={() => handleToggleAmenity(amenity.id)}
            >
              {isSelected && (
                <View style={[styles.amenityCheck, { backgroundColor: colors.accent }]}>
                  <Check size={12} color="#fff" />
                </View>
              )}
              <Text style={[styles.amenityName, { color: colors.text }]}>{amenity.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderPricingStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>Pricing</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Set your rental rates and booking preferences
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Price per Day *</Text>
        <View style={[styles.inputWithIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <DollarSign size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.inputInner, { color: colors.text }]}
            value={pricePerDay}
            onChangeText={setPricePerDay}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>USD/day</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Price per Hour (optional)</Text>
        <View style={[styles.inputWithIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Clock size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.inputInner, { color: colors.text }]}
            value={pricePerHour}
            onChangeText={setPricePerHour}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>USD/hr</Text>
        </View>
      </View>

      <View style={[styles.toggleRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Instant Book</Text>
          <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>Guests can book immediately without approval</Text>
        </View>
        <Switch
          value={instantBook}
          onValueChange={setInstantBook}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Cancellation Policy</Text>
        {CANCELLATION_POLICIES.map((policy) => (
          <TouchableOpacity
            key={policy.key}
            style={[
              styles.policyOption,
              { backgroundColor: colors.backgroundSecondary, borderColor: cancellationPolicy === policy.key ? colors.accent : colors.border },
              cancellationPolicy === policy.key && { borderWidth: 2 },
            ]}
            onPress={() => setCancellationPolicy(policy.key)}
          >
            <View style={styles.policyContent}>
              <Text style={[styles.policyLabel, { color: colors.text }]}>{policy.label}</Text>
              <Text style={[styles.policyDesc, { color: colors.textSecondary }]}>{policy.description}</Text>
            </View>
            {cancellationPolicy === policy.key && (
              <View style={[styles.policyCheck, { backgroundColor: colors.accent }]}>
                <Check size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderRulesStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>Rules & Guidelines</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Add any rules or requirements for renters
      </Text>

      <View style={styles.inputGroup}>
        <View style={[styles.addRuleRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <TextInput
            style={[styles.addRuleInput, { color: colors.text }]}
            value={newRule}
            onChangeText={setNewRule}
            placeholder="e.g. No smoking"
            placeholderTextColor={colors.textTertiary}
            onSubmitEditing={handleAddRule}
          />
          <TouchableOpacity
            style={[styles.addRuleButton, { backgroundColor: colors.accent }]}
            onPress={handleAddRule}
            disabled={!newRule.trim()}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {rules.length > 0 && (
        <View style={styles.rulesList}>
          {rules.map((rule, index) => (
            <View key={index} style={[styles.ruleItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.ruleText, { color: colors.text }]}>{rule}</Text>
              <TouchableOpacity onPress={() => handleRemoveRule(index)}>
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {rules.length === 0 && (
        <View style={[styles.emptyRules, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Info size={24} color={colors.textTertiary} />
          <Text style={[styles.emptyRulesText, { color: colors.textSecondary }]}>
            No rules added yet. Add rules to set expectations for renters.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.stepTitle, { color: colors.text }]}>Review Your Listing</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Review your submission before sending for approval
      </Text>

      <View style={[styles.reviewCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        {images.length > 0 ? (
          <Image source={{ uri: images[0] }} style={styles.reviewImage} />
        ) : (
          <TouchableOpacity 
            style={[styles.reviewImagePlaceholder, { backgroundColor: colors.error + '15', borderColor: colors.error, borderWidth: 2 }]}
            onPress={() => setCurrentStep('details')}
          >
            <Camera size={32} color={colors.error} />
            <Text style={[styles.reviewImagePlaceholderText, { color: colors.error, fontWeight: '600' as const }]}>⚠️ Photo Required</Text>
            <Text style={[styles.reviewImagePlaceholderText, { color: colors.textSecondary, fontSize: 12 }]}>Tap to add photos</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.reviewContent}>
          <View style={[styles.reviewBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.reviewBadgeText}>
              {category === 'car' ? 'Vehicle' : category === 'boat' ? 'Boat' : 'Property'}
            </Text>
          </View>
          
          <Text style={[styles.reviewTitle, { color: colors.text }]}>{title || 'Untitled Listing'}</Text>
          
          <View style={styles.reviewMeta}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.reviewMetaText, { color: colors.textSecondary }]}>{location || 'No location'}</Text>
          </View>
          
          <Text style={[styles.reviewPrice, { color: colors.accent }]}>
            ${pricePerDay || '0'}
            <Text style={[styles.reviewPriceUnit, { color: colors.textSecondary }]}>/day</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.reviewSection, { borderColor: colors.border }]}>
        <Text style={[styles.reviewSectionTitle, { color: colors.text }]}>Specifications</Text>
        {Object.entries(buildSpecs()).map(([key, value]) => (
          <View key={key} style={styles.reviewSpecRow}>
            <Text style={[styles.reviewSpecLabel, { color: colors.textSecondary }]}>{key}</Text>
            <Text style={[styles.reviewSpecValue, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.reviewSection, { borderColor: colors.border }]}>
        <Text style={[styles.reviewSectionTitle, { color: colors.text }]}>Amenities</Text>
        <View style={styles.reviewAmenities}>
          {selectedAmenities.length > 0 ? (
            selectedAmenities.map((id) => {
              const amenity = amenitiesForCategory.find(a => a.id === id);
              return amenity ? (
                <View key={id} style={[styles.reviewAmenityChip, { backgroundColor: colors.border }]}>
                  <Text style={[styles.reviewAmenityText, { color: colors.text }]}>{amenity.name}</Text>
                </View>
              ) : null;
            })
          ) : (
            <Text style={[styles.reviewNoItems, { color: colors.textSecondary }]}>No amenities selected</Text>
          )}
        </View>
      </View>

      <View style={[styles.reviewSection, { borderColor: colors.border }]}>
        <Text style={[styles.reviewSectionTitle, { color: colors.text }]}>Rules</Text>
        {rules.length > 0 ? (
          rules.map((rule, index) => (
            <Text key={index} style={[styles.reviewRule, { color: colors.text }]}>• {rule}</Text>
          ))
        ) : (
          <Text style={[styles.reviewNoItems, { color: colors.textSecondary }]}>No rules added</Text>
        )}
      </View>

      <View style={[styles.reviewNotice, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.1)', borderColor: '#F59E0B' }]}>
        <Info size={20} color="#F59E0B" />
        <Text style={[styles.reviewNoticeText, { color: colors.text }]}>
          Your listing will be reviewed by our moderators before going live. This usually takes 24-48 hours.
        </Text>
      </View>
    </ScrollView>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'category':
        return renderCategoryStep();
      case 'details':
        return renderDetailsStep();
      case 'specs':
        return renderSpecsStep();
      case 'amenities':
        return renderAmenitiesStep();
      case 'pricing':
        return renderPricingStep();
      case 'rules':
        return renderRulesStep();
      case 'review':
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} testID="closeRentalModal">
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>List Your Rental</Text>
          <View style={styles.headerRight}>
            <Text style={[styles.stepIndicator, { color: colors.textSecondary }]}>
              {stepIndex + 1}/{STEPS.length}
            </Text>
          </View>
        </View>

        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
        </View>

        {renderStepContent()}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10, borderTopColor: colors.border }]}>
          {currentStep !== 'category' && (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={handleBack}
              testID="rentalBackButton"
            >
              <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          )}
          
          {currentStep === 'review' ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: images.length >= 1 ? colors.accent : colors.border },
              ]}
              onPress={handleSubmit}
              testID="rentalSubmitButton"
            >
              <Text style={[styles.submitButtonText, { color: images.length >= 1 ? '#fff' : colors.textTertiary }]}>
                Submit for Review
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: canProceed ? colors.accent : colors.border },
                currentStep === 'category' && { flex: 1 },
              ]}
              onPress={handleNext}
              disabled={!canProceed}
              testID="rentalNextButton"
            >
              <Text style={[styles.nextButtonText, { color: canProceed ? '#fff' : colors.textTertiary }]}>
                Continue
              </Text>
              <ChevronRight size={20} color={canProceed ? '#fff' : colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  progressBar: {
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  categoryGrid: {
    gap: 16,
  },
  categoryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
  },
  categoryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 14,
  },
  checkBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 6,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  inputSuffix: {
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageScroll: {
    flexDirection: 'row',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addImageText: {
    fontSize: 12,
    marginTop: 6,
  },
  imagePreviewWrap: {
    marginRight: 12,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  amenityCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityName: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  policyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  policyContent: {
    flex: 1,
  },
  policyLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  policyDesc: {
    fontSize: 13,
  },
  policyCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  addRuleInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  addRuleButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesList: {
    gap: 10,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  ruleText: {
    fontSize: 15,
    flex: 1,
  },
  emptyRules: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyRulesText: {
    fontSize: 14,
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  reviewImage: {
    width: '100%',
    height: 180,
  },
  reviewImagePlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewImagePlaceholderText: {
    fontSize: 14,
  },
  reviewContent: {
    padding: 16,
  },
  reviewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  reviewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reviewMetaText: {
    fontSize: 14,
  },
  reviewPrice: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  reviewPriceUnit: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  reviewSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    marginBottom: 8,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  reviewSpecRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewSpecLabel: {
    fontSize: 14,
  },
  reviewSpecValue: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  reviewAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewAmenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reviewAmenityText: {
    fontSize: 13,
  },
  reviewNoItems: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  reviewRule: {
    fontSize: 14,
    marginBottom: 6,
  },
  reviewNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  reviewNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
