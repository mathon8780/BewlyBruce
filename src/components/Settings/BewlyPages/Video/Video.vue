<script setup lang="ts">
import { settings } from '~/logic'

import SettingsItem from '../../components/SettingsItem.vue'
import SettingsItemGroup from '../../components/SettingsItemGroup.vue'
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.group_blocking')">
      <SettingsItem :title="$t('settings.block_charge_exclusive')" :desc="$t('settings.block_charge_exclusive_desc')">
        <Radio v-model="settings.blockChargeExclusive" />
      </SettingsItem>
      <SettingsItem :title="$t('settings.block_ads_and_promotions')" :desc="$t('settings.block_ads_and_promotions_desc')">
        <Radio v-model="settings.blockAdsAndPromotions" />
      </SettingsItem>
      <SettingsItem :title="$t('settings.block_at_comments')" :desc="$t('settings.block_at_comments_desc')">
        <Radio v-model="settings.blockAtComments" />
      </SettingsItem>
    </SettingsItemGroup>
    <SettingsItemGroup :title="$t('settings.group_playback_page')">
      <SettingsItem :title="$t('settings.block_related_videos')" :desc="$t('settings.block_related_videos_desc')">
        <Radio v-model="settings.blockRelatedVideos" />
      </SettingsItem>
    </SettingsItemGroup>
  </div>
</template>
