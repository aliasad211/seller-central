import { Plus, Trash2 } from 'lucide-react-native';
import { ChevronForward } from '../../components/Chevrons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  categoryDetails,
  createShopProduct,
  deleteShopProduct,
  getShopProduct,
  ProductDraft,
  setProductAvailable,
  ShopCategory,
  shopCategories,
  updateShopProduct,
  UploadFile,
} from '../../api/shopContent';
import {
  AppText,
  Button,
  Card,
  Header,
  isRemoteMedia,
  MediaPicker,
  PickedMedia,
  Screen,
  StateView,
  TextField,
  ToggleRow,
} from '../../components';
import { ListingType } from '../../types/models';
import { RootScreenProps } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { colors, spacing, themedStyles } from '../../theme';
import {
  buildParametersFromCategory,
  cascadeParameterDependents,
  FormParameter,
  hydrateParametersFromSaved,
  isParameterLocked,
  isParameterSatisfied,
  serializeParameters,
} from '../../utils/categoryParameters';
import { prepareVideo, VideoTooLongError } from '../../utils/videoCompression';
import { CategoryPickerModal } from './CategoryPickerModal';
import { AddDetailsSheet, ParameterValueSheet } from './ParameterSheets';
import { t } from '../../i18n';

/** Fazl's own limit for one listing. */
/** A listing takes up to ten photos (the backend's MAX_PRODUCT_IMAGES). */
const MAX_PHOTOS = 10;

type Field = 'images' | 'title' | 'description' | 'category' | 'price' | 'parameters';
type Errors = Partial<Record<Field, string>>;

/**
 * Lists a product in the active shop on Fazl, or edits / deletes one — with
 * the same fields, in the same order and with the same rules as the Fazl app's
 * "Sell a Product" form (Native-fazl-app SellProductScreen / ProductForm), so
 * a product looks the same whichever app it was listed from.
 */
export function ProductFormScreen({ route, navigation }: RootScreenProps<'ProductForm'>) {
  const productId = route.params?.productId;
  const shop = useAuth().seller?.shop;
  // A new product's form is usable at once; an edited one waits for the product.
  const [loaded, setLoaded] = useState(!productId);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  /** The chosen category's details are on their way. */
  const [detailsLoading, setDetailsLoading] = useState(false);
  /** The category whose details were asked for last: an older answer is dropped. */
  const detailsFor = useRef('');
  /** The shop's own product category: shown, not chosen (as on Fazl). */
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [originalMedia, setOriginalMedia] = useState<string[]>([]);
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [parameters, setParameters] = useState<FormParameter[]>([]);
  const [price, setPrice] = useState('');
  // What Seller Central lists is retail (Fazl sets it so too); a classified
  // listing is posted from the Fazl app. An existing one keeps its own type
  // (set when it loads), shown here but not changed.
  const [listingType, setListingType] = useState<ListingType>('retail');
  const [available, setAvailable] = useState(true);
  const [wasAvailable, setWasAvailable] = useState(true);
  const [disabledByFazl, setDisabledByFazl] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  /** What a long save is doing, e.g. "Compressing video... 40%". */
  const [progress, setProgress] = useState<string | null>(null);

  // The detail being filled in: a category one (value sheet) or the seller's own.
  const [selecting, setSelecting] = useState<FormParameter | null>(null);
  const [addingDetails, setAddingDetails] = useState(false);
  const [editingDetail, setEditingDetail] = useState<FormParameter | null>(null);

  const shopId = shop?.id;
  // A new product: the shop's categories (light) arrive while the form is
  // already in use. An edited one: the product, its shop's categories and its
  // own category's details together.
  const loadCategories = () => {
    if (!shop || productId) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    shopCategories(shop)
      .then(({ categories: cats, locked }) => {
        setCategories(cats);
        setCategoryLocked(locked);
        // A shop locked to its category starts in it, its details on their way.
        if (locked && cats[0]) chooseCategory(cats[0]);
      })
      .catch(e => setCategoriesError(e instanceof Error ? e.message : t("Couldn't load the categories")))
      .finally(() => setCategoriesLoading(false));
  };

  useEffect(() => {
    if (!shop) return;
    if (!productId) {
      loadCategories();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ categories: cats, locked }, p] = await Promise.all([
          shopCategories(shop),
          getShopProduct(shop.id, productId),
        ]);
        // The listing's own category's details, to lay its saved values over.
        const details = p.categoryId ? await categoryDetails(p.categoryId).catch(() => undefined) : undefined;
        if (cancelled) return;
        setCategoryLocked(locked);
        setCategoriesLoading(false);
        // Keep a listing's own category choosable even if the shop's list changed.
        const own = cats.find(c => c.id === p.categoryId);
        setCategories(
          own || !p.categoryId ? cats : [...cats, { id: p.categoryId, name: p.category || 'Current category' }],
        );
        setMedia([
          ...p.images.map(uri => ({ uri, kind: 'image' as const })),
          ...(p.video ? [{ uri: p.video, kind: 'video' as const }] : []),
        ]);
        setOriginalMedia([...p.images, ...(p.video ? [p.video] : [])]);
        setTitle(p.title);
        setDescription(p.description);
        setCategoryId(p.categoryId ?? '');
        detailsFor.current = p.categoryId ?? '';
        // A retail listing is new: no second-hand Condition (a classified one keeps them).
        setParameters(hydrateParametersFromSaved(p.options, details, { newOnly: p.listingType === 'retail' }));
        setPrice(p.price ? String(p.price) : '');
        setListingType(p.listingType ?? 'classified');
        setAvailable(p.available);
        setWasAvailable(p.available);
        setDisabledByFazl(!!p.disabledByFazl);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : t("Couldn't load this product"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, shopId]);

  const clearError = (key: Field) => setErrors(e => ({ ...e, [key]: undefined }));

  const chooseCategory = (c: ShopCategory) => {
    if (c.id === categoryId) return;
    setCategoryId(c.id);
    setParameters([]);
    clearError('category');
    clearError('parameters');
    // Pre-filled with the category's own details; the seller can add more.
    // Only this category's are fetched, not every category's.
    detailsFor.current = c.id;
    setDetailsLoading(true);
    categoryDetails(c.id)
      .then(details => {
        if (detailsFor.current === c.id) {
          setParameters(buildParametersFromCategory(details, { newOnly: listingType === 'retail' }));
        }
      })
      .catch(e => {
        if (detailsFor.current !== c.id) return;
        setCategoryId('');
        Alert.alert(t("Couldn't load this category's details"), e instanceof Error ? e.message : t('Please choose it again.'));
      })
      .finally(() => {
        if (detailsFor.current === c.id) setDetailsLoading(false);
      });
  };

  const openParameter = (p: FormParameter) => {
    if (isParameterLocked(p)) return; // nothing to pick until its parent has a value
    if (p.fromCategory) {
      setSelecting(p);
    } else {
      setEditingDetail(p);
      setAddingDetails(true);
    }
  };

  const saveValue = (values: string[]) => {
    const index = parameters.findIndex(p => p.id === selecting?.id);
    const withValue = parameters.map(p => (p.id === selecting?.id ? { ...p, variants: values } : p));
    const updated = index === -1 ? withValue : cascadeParameterDependents(withValue, index);
    setParameters(updated);
    clearError('parameters');
    // Like the Fazl app: go straight on to the next category detail still empty.
    setSelecting(
      updated.slice(index + 1).find(p => p.fromCategory && !p.variants.length && !isParameterLocked(p)) ?? null,
    );
  };

  const saveDetail = (detail: { name: string; values: string[] }) => {
    setParameters(list => {
      const base = editingDetail ? list.filter(p => p.id !== editingDetail.id) : list;
      // The same name twice becomes one detail with both sets of values.
      const same = base.find(p => p.name.trim().toLowerCase() === detail.name.toLowerCase());
      if (same) {
        const variants = [...same.variants, ...detail.values.filter(v => !same.variants.includes(v))];
        return base.map(p => (p.id === same.id ? { ...p, variants } : p));
      }
      const own: FormParameter = {
        id: editingDetail?.id ?? `own-${Date.now()}`,
        name: detail.name,
        variants: detail.values,
        availableValues: detail.values,
        fromCategory: false,
      };
      return editingDetail ? list.map(p => (p.id === editingDetail.id ? own : p)) : [...base, own];
    });
    clearError('parameters');
    setAddingDetails(false);
    setEditingDetail(null);
  };

  const save = async () => {
    // Without them the category's required details couldn't be checked.
    if (detailsLoading) {
      Alert.alert(t('Just a moment'), t("The category's details are still loading."));
      return;
    }
    // The Fazl app's own checks and messages.
    const next: Errors = {};
    if (!title.trim()) next.title = t('Please enter product title');
    if (!description.trim()) next.description = t('Please enter product description');
    if (!categoryId) next.category = t('Please select a category');
    const priceValue = price.trim() ? Number(price) : null;
    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      next.price = t('Please enter a valid price');
    } else if (listingType === 'retail' && !(priceValue && priceValue > 0)) {
      // Customers pay this price when they buy it on Fazl (as in the Fazl app).
      next.price = t('Enter a price: customers pay it when they buy on Fazl.');
    }
    if (parameters.some(p => !isParameterSatisfied(p))) {
      next.parameters = t('Please add at least one value for each parameter');
    }
    if (!media.some(m => m.kind === 'image')) next.images = t('Please add at least one image');
    setErrors(next);
    const first = Object.values(next).find(Boolean);
    if (first) {
      Alert.alert(t('Error'), first);
      return;
    }
    if (!shop) return;

    setSaving(true);
    try {
      let newVideo: UploadFile | undefined;
      const pickedVideo = media.find(m => m.kind === 'video' && !isRemoteMedia(m));
      if (pickedVideo) {
        setProgress(t('Compressing video...'));
        newVideo = await prepareVideo(
          {
            uri: pickedVideo.uri,
            fileName: pickedVideo.name,
            type: pickedVideo.type,
            duration: pickedVideo.duration,
            fileSize: pickedVideo.fileSize,
          },
          p => setProgress(`${t('Compressing video...')} ${Math.round(p * 100)}%`),
        );
      }
      setProgress(productId ? t('Updating...') : t('Uploading...'));
      const kept = new Set(media.filter(isRemoteMedia).map(m => m.uri));
      const draft: ProductDraft = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        price: priceValue,
        listingType,
        parameters: serializeParameters(parameters),
        newImages: media
          .filter(m => m.kind === 'image' && !isRemoteMedia(m))
          .map((m, i) => ({
            uri: m.uri,
            name: m.name || `image_${i}.jpg`,
            type: m.type || 'image/jpeg',
          })),
        newVideo,
        removedMedia: originalMedia.filter(url => !kept.has(url)),
      };
      const saved = productId
        ? await updateShopProduct(productId, draft)
        : await createShopProduct(shop.id, draft);
      // New products start out live, so only a switch turned off needs sending.
      if (!disabledByFazl && available !== (productId ? wasAvailable : true)) {
        await setProductAvailable(saved.id, available);
      }
      Alert.alert(
        t('Success'),
        !available
          ? t(`Saved and hidden: customers won't see it on Fazl until you turn "Available on Fazl" back on.`)
          : productId
          ? t('Product updated successfully!')
          : t('Your product is now listed in {shop} on Fazl.', { shop: shop.name }),
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        t('Error'),
        e instanceof VideoTooLongError
          ? t('Video must be 60 seconds or less.')
          : e instanceof Error && e.message
          ? e.message
          : t('Failed to upload product. Please try again.'),
      );
      setSaving(false);
      setProgress(null);
    }
  };

  const remove = () =>
    Alert.alert(t('Delete this product?'), t('It will be removed from your shop on Fazl. This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShopProduct(productId as string);
            navigation.goBack();
          } catch (e) {
            Alert.alert(t("Couldn't delete the product"), e instanceof Error ? e.message : '');
          }
        },
      },
    ]);

  const header = (
    <Header
      title={productId ? t('Edit Product') : t('Sell a Product')}
      subtitle={shop?.name}
      right={
        productId ? (
          <Pressable onPress={remove} hitSlop={10} accessibilityLabel={t('Delete product')}>
            <Trash2 size={22} color={colors.danger} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (!loaded) {
    return (
      <Screen header={header} scroll={false}>
        <StateView error={loadError} />
      </Screen>
    );
  }

  const category = categories.find(c => c.id === categoryId);

  return (
    <Screen
      header={header}
      footer={
        <Button
          title={progress ?? (productId ? t('Update') : t('Upload'))}
          flex
          loading={saving && !progress}
          disabled={saving}
          onPress={save}
        />
      }
    >
      <Section>
        <MediaPicker
          label={t('Photos & video')}
          value={media}
          onChange={m => {
            setMedia(m);
            clearError('images');
          }}
          accept="both"
          maxImages={MAX_PHOTOS}
          maxVideoSeconds={60}
          hint={t('Up to {count} photos and 1 video (60 seconds or less). The first photo is the cover.', {
            count: MAX_PHOTOS,
          })}
        />
        {errors.images ? <ErrorText text={errors.images} /> : null}
      </Section>

      <Section>
        <TextField
          label={t('Title')}
          value={title}
          onChangeText={text => {
            setTitle(text);
            clearError('title');
          }}
          placeholder={t('e.g. Professional Home Cleaner.')}
          maxLength={120}
          error={errors.title}
        />
        <TextField
          label={t('Describe your product')}
          value={description}
          onChangeText={text => {
            setDescription(text);
            clearError('description');
          }}
          placeholder={t("e.g. Describe what your service offers, what's included, how long it takes, and anything the customer should know before booking.")}
          multiline
          maxLength={2000}
          error={errors.description}
        />
      </Section>

      <Section>
        <AppText variant="bodyBold" style={styles.typeLabel}>
          {t('Type')}
        </AppText>
        <AppText>{listingType === 'retail' ? t('Retail') : t('Classified')}</AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.typeHint}>
          {listingType === 'retail'
            ? t('Customers buy it on Fazl with Buy now or Add to cart, and the order comes to you here. Classified listings are posted from the Fazl app.')
            : t("Posted from the Fazl app: customers contact you about it (chat, offer, WhatsApp); it can't be ordered on Fazl.")}
        </AppText>
      </Section>

      <Section>
        {/* Fazl's "Category" row: fixed for a shop locked to its own category,
            otherwise it opens the category list. */}
        <Row
          label={t('Category')}
          value={
            categoriesLoading
              ? t('Loading categories…')
              : categoriesError
              ? t("Couldn't load. Tap to try again")
              : category?.name ?? ''
          }
          muted={categoriesLoading || !!categoriesError}
          onPress={
            categoriesError
              ? loadCategories
              : categoryLocked || categoriesLoading
              ? undefined
              : () => setPickingCategory(true)
          }
        />
        {errors.category ? <ErrorText text={errors.category} /> : null}
        {detailsLoading ? (
          <AppText variant="caption" color={colors.textMuted} style={styles.params}>
            {t("Loading the category's details…")}
          </AppText>
        ) : null}

        {parameters.length ? (
          <View style={styles.params}>
            {parameters.map(p => {
              const isLocked = isParameterLocked(p);
              const parent = isLocked && p.dependsOnIndex !== undefined ? parameters[p.dependsOnIndex] : null;
              return (
                <Row
                  key={p.id}
                  // Admin made it optional: it may be left empty.
                  label={p.isOptional ? t('{name} (optional)', { name: p.name }) : p.name}
                  value={
                    isLocked
                      ? t('Choose {name} first', { name: parent?.name ?? '' })
                      : p.variants.length
                      ? p.variants.join(', ')
                      : t('Select value')
                  }
                  muted={isLocked || !p.variants.length}
                  onPress={isLocked ? undefined : () => openParameter(p)}
                />
              );
            })}
          </View>
        ) : null}
        <Button
          title={t('Add Details')}
          icon={Plus}
          variant="ghost"
          size="sm"
          onPress={() => {
            setEditingDetail(null);
            setAddingDetails(true);
          }}
          style={styles.addDetails}
        />
        {errors.parameters ? <ErrorText text={errors.parameters} /> : null}
      </Section>

      <Section>
        <TextField
          label={t('Price')}
          prefix={t('Rs')}
          value={price}
          onChangeText={text => {
            setPrice(text.replace(/\D/g, ''));
            clearError('price');
          }}
          keyboardType="number-pad"
          placeholder={listingType === 'retail' ? t('e.g. 2500') : t('Optional')}
          error={errors.price}
          hint={
            listingType === 'retail'
              ? t('What customers pay when they order it.')
              : t('Leave empty to show no price, as on Fazl.')
          }
        />
      </Section>

      <Section>
        {disabledByFazl ? (
          <AppText color={colors.danger}>
            {t("Fazl has disabled this product, so customers can't see it. Contact Fazl support to have it enabled again.")}
          </AppText>
        ) : (
          <ToggleRow
            label={t('Available on Fazl')}
            description={t('Turn off to hide it from customers without deleting it. Turn on again any time.')}
            value={available}
            onChange={setAvailable}
          />
        )}
      </Section>

      <CategoryPickerModal
        visible={pickingCategory}
        categories={categories}
        selectedId={categoryId}
        onClose={() => setPickingCategory(false)}
        onSelect={chooseCategory}
      />
      <ParameterValueSheet parameter={selecting} onClose={() => setSelecting(null)} onSave={saveValue} />
      <AddDetailsSheet
        visible={addingDetails}
        editing={editingDetail}
        onClose={() => {
          setAddingDetails(false);
          setEditingDetail(null);
        }}
        onSave={saveDetail}
        onRemove={() => {
          setParameters(list => list.filter(p => p.id !== editingDetail?.id));
          setAddingDetails(false);
          setEditingDetail(null);
        }}
      />
    </Screen>
  );
}

/** "Label ........ value ›" — a detail row, as on the Fazl form. */
function Row({
  label,
  value,
  muted,
  onPress,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <AppText variant="bodyBold" style={styles.rowLabel} numberOfLines={1}>
        {label}
      </AppText>
      <AppText color={muted ? colors.textSubtle : colors.textMuted} style={styles.rowValue} numberOfLines={1}>
        {value}
      </AppText>
      {onPress ? <ChevronForward size={18} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <Card style={styles.section}>{children}</Card>;
}

function ErrorText({ text }: { text: string }) {
  return (
    <AppText variant="caption" color={colors.danger} style={styles.errorText}>
      {text}
    </AppText>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  section: { marginBottom: spacing.md },
  errorText: { marginTop: spacing.xs },
  typeLabel: { marginBottom: spacing.sm },
  typeHint: { marginTop: spacing.sm },
  params: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flexShrink: 0, maxWidth: '45%' },
  rowValue: { flex: 1, textAlign: 'right' },
  addDetails: { alignSelf: 'flex-start', marginTop: spacing.sm },
}));
