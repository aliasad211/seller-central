import { List, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Header, Screen } from '../../components';
import { Block, PolicyPart, PolicySection, PRIVACY_POLICY } from '../../content/legal/privacy-policy';
import { TERMS_CONDITIONS } from '../../content/legal/terms-conditions';
import { language, t } from '../../i18n';
import { RootScreenProps } from '../../navigation/types';
import { colors, radius, spacing, themedStyles } from '../../theme';

export type LegalDoc = 'privacy' | 'terms';

const DOCS: Record<LegalDoc, { title: string; heading: string; parts: PolicyPart[] }> = {
  privacy: { title: 'Privacy policy', heading: 'Fazl App Privacy Policy', parts: PRIVACY_POLICY },
  terms: { title: 'Terms & conditions', heading: 'Fazl App Terms and Conditions', parts: TERMS_CONDITIONS },
};

type Row = { kind: 'part'; key: string; part: PolicyPart } | { kind: 'section'; key: string; section: PolicySection };

/** One block of a section: a paragraph, a list, a subheading or definitions. */
function BlockView({ block }: { block: Block }) {
  if (block.type === 'p') {
    return (
      <AppText style={styles.text}>
        {block.text}
        {block.strong ? <AppText variant="bodyBold">{` ${block.strong}`}</AppText> : null}
      </AppText>
    );
  }
  if (block.type === 'h') {
    return <AppText variant="bodyBold" style={styles.text}>{block.text}</AppText>;
  }
  if (block.type === 'ul' || block.type === 'ol') {
    return (
      <View style={styles.list}>
        {block.items.map((item, i) => (
          <View key={i} style={styles.listRow}>
            <AppText style={styles.marker} color={colors.textMuted}>
              {block.type === 'ol' ? `${i + 1}.` : '•'}
            </AppText>
            <AppText style={[styles.text, styles.flex]}>{item}</AppText>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {block.items.map((item, i) => (
        <AppText key={i} style={styles.text}>
          <AppText variant="bodyBold">{item.term}</AppText> {item.definition}
        </AppText>
      ))}
    </View>
  );
}

/**
 * Fazl's privacy policy or terms and conditions — the same text as the Fazl
 * app and the website — read in the app. The documents are in English, so they
 * stay left to right in Urdu too. Contents jumps to any section.
 */
export function LegalScreen({ route }: RootScreenProps<'Legal'>) {
  const doc = DOCS[route.params?.doc] ?? DOCS.privacy;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Row>>(null);
  const [contentsOpen, setContentsOpen] = useState(false);

  const rows = useMemo<Row[]>(
    () =>
      doc.parts.flatMap(part => [
        ...(part.label || part.title ? [{ kind: 'part' as const, key: part.id, part }] : []),
        ...part.sections.map(section => ({ kind: 'section' as const, key: section.id, section })),
      ]),
    [doc],
  );
  const sections = useMemo(() => rows.filter(r => r.kind === 'section'), [rows]);

  const jumpTo = (key: string) => {
    setContentsOpen(false);
    const index = rows.findIndex(r => r.key === key);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  };

  return (
    <Screen header={<Header title={t(doc.title)} />} scroll={false} padded={false}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={r => r.key}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        initialNumToRender={6}
        windowSize={9}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // Rows not measured yet: get close, then land on it once laid out.
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 }), 250);
        }}
        ListHeaderComponent={
          <View style={styles.head}>
            <AppText variant="heading" style={styles.text}>
              {doc.heading}
            </AppText>
            <AppText variant="caption" color={colors.textMuted} style={styles.text}>
              {`${sections.length} sections`}
            </AppText>
            {language === 'ur' ? (
              <AppText variant="caption" color={colors.textMuted} style={styles.note}>
                {t('This document is in English.')}
              </AppText>
            ) : null}
            <Pressable
              onPress={() => setContentsOpen(true)}
              style={({ pressed }) => [styles.contentsButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <List size={16} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>
                {t('Contents')}
              </AppText>
            </Pressable>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'part' ? (
            <View style={styles.part}>
              {item.part.label ? (
                <AppText variant="small" color={colors.primary} style={styles.text}>
                  {item.part.label.toUpperCase()}
                </AppText>
              ) : null}
              {item.part.title ? (
                <AppText variant="subheading" style={styles.text}>
                  {item.part.title}
                </AppText>
              ) : null}
            </View>
          ) : (
            <View style={styles.section}>
              <AppText variant="subheading" style={styles.text}>
                <AppText variant="subheading" color={colors.textMuted}>{`${item.section.number}. `}</AppText>
                {item.section.heading}
              </AppText>
              {item.section.blocks.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </View>
          )
        }
      />

      <Modal visible={contentsOpen} animationType="slide" transparent onRequestClose={() => setContentsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <AppText variant="subheading">{t('Contents')}</AppText>
              <Pressable onPress={() => setContentsOpen(false)} hitSlop={12} accessibilityLabel={t('Close')}>
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={sections}
              keyExtractor={r => r.key}
              contentContainerStyle={styles.ltr}
              renderItem={({ item }) =>
                item.kind === 'section' ? (
                  <Pressable
                    onPress={() => jumpTo(item.key)}
                    style={({ pressed }) => [styles.contentsRow, pressed && styles.pressed]}
                  >
                    <AppText color={colors.textMuted} style={styles.contentsNumber}>
                      {`${item.section.number}.`}
                    </AppText>
                    <AppText style={[styles.text, styles.flex]}>{item.section.heading}</AppText>
                  </Pressable>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    // English text: laid out and read left to right even in the Urdu app.
    ltr: { direction: 'ltr' },
    text: { writingDirection: 'ltr' },
    content: { direction: 'ltr', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    head: {
      paddingBottom: spacing.md,
      marginBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 2,
    },
    note: { marginTop: spacing.xs },
    contentsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    pressed: { opacity: 0.6 },
    part: {
      marginTop: spacing.xl,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 2,
    },
    section: { marginTop: spacing.lg, gap: spacing.sm },
    list: { gap: spacing.xs },
    listRow: { flexDirection: 'row', gap: spacing.sm },
    marker: { minWidth: 18 },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    sheet: {
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    contentsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    contentsNumber: { minWidth: 28 },
  }),
);
