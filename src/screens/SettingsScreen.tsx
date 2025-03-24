import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useTranslation } from '../i18n';
import { MaterialIcons } from '@expo/vector-icons';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { t, locale, changeLocale, supportedLocales } = useTranslation();
  
  const languageNames: { [key: string]: string } = {
    en: t('settings.english'),
    ko: t('settings.korean'),
    zh: t('settings.chinese'),
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          {supportedLocales.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageButton,
                locale === lang ? styles.activeLanguageButton : null,
              ]}
              onPress={() => changeLocale(lang)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  locale === lang ? styles.activeLanguageButtonText : null,
                ]}
              >
                {languageNames[lang]}
              </Text>
              {locale === lang && (
                <MaterialIcons name="check" size={24} color="#2196F3" />
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
          <View style={styles.aboutContainer}>
            <Text style={styles.appName}>{t('common.appName')}</Text>
            <Text style={styles.versionText}>{t('settings.version')}: 1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  activeLanguageButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  languageButtonText: {
    fontSize: 16,
    color: 'white',
  },
  activeLanguageButtonText: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  aboutContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
  },
}); 