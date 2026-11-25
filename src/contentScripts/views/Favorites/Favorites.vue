<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import draggable from 'vuedraggable'
import browser from 'webextension-polyfill'

import Dialog from '~/components/Dialog.vue'
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useFavoriteSeason } from '~/composables/useFavoriteSeason'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import { blockedUploaders, isUploaderBlocked } from '~/logic/blockedUploaders'
import type { CollectedCategory, CollectedFoldersResult, FavoriteSeasonVideo, FavoritesResult, Info as FavoriteFolderInfo, Media } from '~/models/video/favorite'
import type { FavoritesCategoryResult, List as CategoryItem } from '~/models/video/favoriteCategory'
import api from '~/utils/api'
import type { FavoriteCategoryOrderUpdate } from '~/utils/favoriteCategoryOrder'
import { orderFavoriteCategories } from '~/utils/favoriteCategoryOrder'
import { getCSRF, getUserID, openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'
import emitter from '~/utils/mitt'

const { t } = useI18n()
const toast = useToast()

type TransferAction = 'copy' | 'move'
type SelectedAction = 'unfavorite' | TransferAction
type FavoriteItem = FavoriteSeasonVideo & Pick<Media, 'type' | 'link'>
const FOLDER_TYPE = 11
const SEASON_TYPE = 21

const favoriteCategories = shallowRef<CategoryItem[]>([])
const selectedCategory = ref<CategoryItem>()
const browseSaved = ref(false)
const savedCategories = shallowRef<CollectedCategory[]>()
const savingOrder = ref(false)
const selectedSaved = ref<CollectedCategory>()
const activeCategory = computed(() => browseSaved.value ? selectedSaved.value : selectedCategory.value)
const sidebarCategories = computed(() => browseSaved.value ? savedCategories.value ?? [] : favoriteCategories.value)
const sidebarLabel = computed(() => t(browseSaved.value ? 'favorites.saved_categories' : 'favorites.own_folders'))
const isSeason = computed(() => browseSaved.value && selectedSaved.value?.type === SEASON_TYPE)
const season = useFavoriteSeason(() => getCSRF() ? getUserID() : '')
const searchLabel = computed(() => t(isSeason.value ? 'favorites.search_collection' : 'favorites.search'))
const armedPrivacy = ref<{ id: number, until: number }>()
const savingPrivacy = ref<number>()
let privacyTimer: ReturnType<typeof setTimeout> | undefined
const activatedCategoryCover = ref('')
const categoryCover = computed(() => (isSeason.value ? season.content.value?.cover : undefined) || activatedCategoryCover.value)
const shouldMoveCtrlBarUp = ref(false)
const keyword = ref('')
const query = ref('')
const categoriesLoading = ref(false)
const categoriesFailed = ref(false)
const batchMode = ref(false)
const selectedKeys = reactive(new Map<string, number | undefined>())
const isUpdating = ref(false)
const reconciliation = ref<{ source: boolean, destination?: number }>()
const actionsDisabled = computed(() => isUpdating.value || !!reconciliation.value)
const canReorder = computed(() => browseSaved.value && !categoriesLoading.value && !actionsDisabled.value
  && !savingOrder.value && (savedCategories.value?.length ?? 0) > 1)
const transferAction = ref<TransferAction>()
const targetFolderID = ref<number>()
const destinationFolders = computed(() => favoriteCategories.value.filter(folder => folder.id !== selectedCategory.value?.id))
const { handleBackToTop } = useBewlyApp()
let currentPageNum = 1
let alive = true
let categoryGeneration = 0
let categoriesAccount = ''
const PAGE_SIZE = 20

const {
  visibleItems: folderResources,
  isLoading: folderLoading,
  noMoreContent: folderDone,
  loadFailed: folderFailed,
  windowFull: folderWindowFull,
  load: loadFolder,
  reset,
  continueWindow,
} = useWindowedFeed<FavoriteItem>({
  key: favoriteKey,
  isVisible: item => !isUploaderBlocked(favoriteUploaderMid(item)),
  pageRefresh: (): Promise<void> => isSeason.value ? season.refresh() : reset(),
  scrollTarget: () => 0,
  beforeLoading: () => {},
  afterLoading: () => {},
  resetCursor: () => {
    currentPageNum = 1
    if (!isUpdating.value)
      selectedKeys.clear()
  },
  loadPage: async (current) => {
    if (!getCSRF())
      return { items: [], done: true, unauthorized: true }
    const saved = browseSaved.value
    const category = activeCategory.value
    if (!category || isSeason.value)
      return { items: [], done: true }
    const res: FavoritesResult = await api.favorite.getFavoriteResources({
      media_id: category.id,
      pn: currentPageNum,
      keyword: query.value,
    })
    if (!current() || browseSaved.value !== saved)
      return { items: [], done: true }
    if (res.code !== 0)
      throw new Error(res.message)
    currentPageNum++
    activatedCategoryCover.value = res.data.info.cover
    if (!saved) {
      favoriteCategories.value = favoriteCategories.value.map(item => item.id === category.id && item.media_count !== res.data.info.media_count
        ? { ...item, media_count: res.data.info.media_count }
        : item)
    }
    const items = res.data.medias ?? []
    return { items, done: !items.length || res.data.has_more === false }
  },
})
const seasonResources = computed(() => (season.content.value?.items ?? []).map(item => ({ ...item, type: 2, link: '' })))
const favoriteResources = computed(() => {
  if (!isSeason.value)
    return folderResources.value
  const search = query.value.toLowerCase()
  return seasonResources.value.filter(item => !isUploaderBlocked(favoriteUploaderMid(item)) && item.title.toLowerCase().includes(search))
})
const isLoading = computed(() => isSeason.value ? season.isLoading.value : folderLoading.value)
const noMoreContent = computed(() => isSeason.value ? !!season.content.value : folderDone.value)
const loadFailed = computed(() => isSeason.value ? season.loadFailed.value : folderFailed.value)
const windowFull = computed(() => !isSeason.value && folderWindowFull.value)
const isFullPageLoading = computed(() => categoriesLoading.value || (isLoading.value && !favoriteResources.value.length))
const allLoadedSelected = computed(() => favoriteResources.value.length > 0 && favoriteResources.value.every(item => selectedKeys.has(favoriteKey(item))))

function favoriteKey(item: FavoriteItem) {
  return `${item.id}:${item.type}`
}

function load() {
  return isSeason.value ? season.refresh() : loadFolder()
}

watch(season.content, (content) => {
  const selected = selectedSaved.value
  if (!content || !selected || !isSeason.value)
    return
  const title = content.title || selected.title
  const cover = content.cover || selected.cover
  if (title === selected.title && cover === selected.cover && content.count === selected.media_count)
    return
  const updated = { ...selected, title, cover, media_count: content.count }
  selectedSaved.value = updated
  savedCategories.value = savedCategories.value?.map(item => categoryKey(item) === categoryKey(updated) ? updated : item)
})

function categoryKey(item: CategoryItem | CollectedCategory) {
  return `${'attr' in item ? 'own' : item.type}:${item.id}`
}

function toggleSelection(item: FavoriteItem) {
  const key = favoriteKey(item)
  if (selectedKeys.has(key))
    selectedKeys.delete(key)
  else
    selectedKeys.set(key, favoriteUploaderMid(item))
}

watch(blockedUploaders, () => {
  for (const [key, mid] of selectedKeys) {
    if (isUploaderBlocked(mid))
      selectedKeys.delete(key)
  }
})

function toggleLoadedSelection() {
  const deselect = allLoadedSelected.value
  for (const item of favoriteResources.value) {
    const key = favoriteKey(item)
    if (deselect)
      selectedKeys.delete(key)
    else
      selectedKeys.set(key, favoriteUploaderMid(item))
  }
}

function closeBatchMode() {
  selectedKeys.clear()
  batchMode.value = false
  closeTransferDialog()
}

function openTransferDialog(action: TransferAction) {
  if (actionsDisabled.value || !selectedKeys.size || !destinationFolders.value.length)
    return
  targetFolderID.value = undefined
  transferAction.value = action
}

function closeTransferDialog() {
  transferAction.value = undefined
  targetFolderID.value = undefined
}

function handleTopBarVisibility(val: boolean) {
  shouldMoveCtrlBarUp.value = settings.value.autoHideTopBar && settings.value.showTopBar && !val
}

onMounted(() => {
  emitter.on(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibility)
  void initData()
})
onActivated(() => {
  if (categoriesAccount !== getUserID())
    void initData()
  else if (isSeason.value)
    void season.open(selectedSaved.value?.id)
})
onBeforeUnmount(() => {
  alive = false
  season.clear()
  cancelPrivacy()
  categoryGeneration++
  emitter.off(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibility)
})

async function initData() {
  const account = getUserID()
  if (categoriesAccount !== account) {
    categoriesAccount = account
    savedCategories.value = undefined
    selectedSaved.value = undefined
    favoriteCategories.value = []
    selectedCategory.value = undefined
    season.clear()
  }
  if (!getCSRF())
    return
  const token = ++categoryGeneration
  categoriesLoading.value = true
  categoriesFailed.value = false
  try {
    if (browseSaved.value) {
      const fresh = await fetchSavedCategories()
      if (!alive || token !== categoryGeneration || account !== getUserID())
        return
      const items = await syncSavedOrder(fresh, account)
      if (!alive || token !== categoryGeneration || account !== getUserID())
        return
      savedCategories.value = items
      categoriesLoading.value = false
      await changeSavedCategory(items.find(item => item.id === selectedSaved.value?.id && item.type === selectedSaved.value.type) ?? items[0])
      return
    }
    const categories = await fetchCategories()
    if (!alive || token !== categoryGeneration || account !== getUserID())
      return
    favoriteCategories.value = categories
    categoriesLoading.value = false
    const category = categories.find(item => item.id === selectedCategory.value?.id) ?? categories[0]
    if (category) {
      await changeCategory(category)
    }
    else {
      selectedCategory.value = undefined
      await reset()
    }
  }
  catch {
    if (alive && token === categoryGeneration)
      categoriesFailed.value = true
  }
  finally {
    if (alive && token === categoryGeneration)
      categoriesLoading.value = false
  }
}

async function fetchCategories() {
  const res: FavoritesCategoryResult = await api.favorite.getFavoriteCategories({ up_mid: getUserID() })
  if (res.code !== 0)
    throw new Error(res.message)
  return res.data?.list ?? []
}

async function fetchSavedCategories() {
  const items: CollectedCategory[] = []
  const seen = new Set<string>()
  const mid = getUserID()
  for (let page = 1; ; page++) {
    if (!alive || !browseSaved.value || getUserID() !== mid)
      return []
    const res: CollectedFoldersResult = await api.favorite.getCollectedFolders({ up_mid: mid, pn: page, ps: PAGE_SIZE })
    if (res.code !== 0 || !res.data)
      throw new Error(res.message)
    const batch = res.data.list ?? []
    const size = seen.size
    for (const { id, mid, type, title, cover, media_count } of batch) {
      const key = `${type}:${id}`
      if ((type === FOLDER_TYPE || type === SEASON_TYPE) && !seen.has(key))
        items.push({ id, mid, type, title, cover, media_count })
      seen.add(key)
    }
    if (!res.data.has_more)
      return items
    if (seen.size === size)
      throw new Error('Collected folders pagination stalled')
  }
}

async function toggleSavedMode() {
  if (actionsDisabled.value || categoriesLoading.value)
    return
  browseSaved.value = !browseSaved.value
  if (!browseSaved.value)
    season.clear()
  cancelPrivacy()
  await initData()
}

function isPrivateFolder(folder: { attr: number }) {
  return (folder.attr & 1) === 1
}

async function saveCategoryOrder(items: CollectedCategory[], account: string, mode: FavoriteCategoryOrderUpdate['mode']) {
  const update: FavoriteCategoryOrderUpdate = { account, mode, keys: items.map(categoryKey) }
  const order: unknown = await browser.runtime.sendMessage({ favoriteCategoryOrderUpdate: update })
  if (!Array.isArray(order) || !order.every(key => typeof key === 'string'))
    throw new Error('Could not save followed collection order')
  return orderFavoriteCategories(items, order, categoryKey)
}

async function syncSavedOrder(items: CollectedCategory[], account: string) {
  try {
    return await saveCategoryOrder(items, account, 'sync')
  }
  catch {
    return orderFavoriteCategories(items, savedCategories.value?.map(categoryKey) ?? [], categoryKey)
  }
}

async function reorderSavedCategories(items: CollectedCategory[]) {
  const account = getUserID()
  const previous = savedCategories.value
  if (!canReorder.value || !account || !previous)
    return
  const current = () => alive && account === getUserID() && browseSaved.value
  savingOrder.value = true
  savedCategories.value = items
  try {
    await saveCategoryOrder(items, account, 'reorder')
  }
  catch {
    if (current()) {
      savedCategories.value = orderFavoriteCategories(savedCategories.value ?? [], previous.map(categoryKey), categoryKey)
      toast.error(t('common.operation_failed'))
    }
  }
  finally {
    savingOrder.value = false
  }
}

function moveSavedCategory(item: CollectedCategory, offset: number) {
  const source = savedCategories.value
  if (!canReorder.value || !source)
    return
  const index = source.findIndex(category => categoryKey(category) === categoryKey(item))
  const target = index + offset
  if (index < 0 || target < 0 || target >= source.length)
    return
  const reordered = [...source]
  reordered.splice(target, 0, ...reordered.splice(index, 1))
  void reorderSavedCategories(reordered)
}

function privacyLabel(folder: CategoryItem) {
  const isPrivate = isPrivateFolder(folder)
  const key = armedPrivacy.value?.id === folder.id
    ? (isPrivate ? 'confirm_public' : 'confirm_private')
    : (isPrivate ? 'make_public' : 'make_private')
  return t(`favorites.${key}`, { folder: folder.title })
}

function cancelPrivacy() {
  clearTimeout(privacyTimer)
  armedPrivacy.value = undefined
}

async function handlePrivacy(folder: CategoryItem) {
  const csrf = getCSRF()
  const mid = getUserID()
  if (actionsDisabled.value || !csrf || !mid)
    return
  const armed = armedPrivacy.value
  cancelPrivacy()
  if (!armed || armed.id !== folder.id || armed.until <= performance.now()) {
    armedPrivacy.value = { id: folder.id, until: performance.now() + 3000 }
    privacyTimer = setTimeout(cancelPrivacy, 3000)
    return
  }

  const makePrivate = !isPrivateFolder(folder)
  isUpdating.value = true
  savingPrivacy.value = folder.id
  try {
    const result: { code: number, data?: FavoriteFolderInfo } = await api.favorite.getFavoriteFolderInfo({ media_id: folder.id })
    const info = result.data
    if (!alive || getUserID() !== mid || getCSRF() !== csrf)
      return
    if (result.code !== 0 || !info || String(info.mid) !== mid)
      throw new Error('Favorite folder is unavailable')

    if (makePrivate !== isPrivateFolder(info)) {
      const update = await api.favorite.editFavoriteFolder({
        media_id: folder.id,
        title: info.title,
        intro: info.intro,
        cover: info.cover,
        privacy: makePrivate ? 1 : 0,
        csrf,
      })
      if (update?.code !== 0)
        throw new Error(update?.message)
    }
    if (!alive || getUserID() !== mid)
      return
    const attr = makePrivate ? info.attr | 1 : info.attr & ~1
    favoriteCategories.value = favoriteCategories.value.map(item => item.id === folder.id ? { ...item, attr } : item)
    if (selectedCategory.value?.id === folder.id)
      selectedCategory.value = { ...selectedCategory.value, attr }
    toast.success(t(makePrivate ? 'favorites.now_private' : 'favorites.now_public', { folder: folder.title }))
  }
  catch {
    if (alive)
      toast.error(t('common.operation_failed'))
  }
  finally {
    isUpdating.value = false
    savingPrivacy.value = undefined
  }
}

async function changeSavedCategory(collection?: CollectedCategory) {
  selectedSaved.value = collection
  await resetCategoryView(collection?.cover)
}

async function changeCategory(categoryItem: CategoryItem) {
  if (actionsDisabled.value)
    return
  selectedCategory.value = categoryItem
  await resetCategoryView()
}

async function resetCategoryView(cover = '') {
  closeBatchMode()
  activatedCategoryCover.value = cover
  query.value = ''
  keyword.value = ''
  handleBackToTop()
  await Promise.all([reset(), season.open(isSeason.value ? selectedSaved.value?.id : undefined)])
}

function handleSearch() {
  if (actionsDisabled.value)
    return
  query.value = keyword.value.trim()
  handleBackToTop()
  if (!isSeason.value)
    void reset()
}

function handlePlayAll() {
  const category = activeCategory.value
  if (!category)
    return
  const destination = isSeason.value ? `${category.mid}/?sid=${category.id}` : `ml${category.id}`
  openLinkToNewTab(`https://www.bilibili.com/list/${destination}`)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

async function handleClean() {
  const folder = selectedCategory.value
  const csrf = getCSRF()
  if (actionsDisabled.value || !folder || !csrf || !confirm(t('favorites.clean_confirm', { folder: folder.title })))
    return

  isUpdating.value = true
  try {
    const res = await api.favorite.cleanFavoriteResources({ media_id: folder.id, csrf })
    if (res?.code !== 0)
      throw new Error(res?.message)
    if (alive) {
      closeBatchMode()
      toast.success(t('favorites.clean_success'))
      reconciliation.value = { source: true }
    }
  }
  catch {
    if (alive) {
      toast.error(t('favorites.clean_failed'))
      reconciliation.value = { source: true }
    }
  }
  finally {
    if (alive)
      await reconcileFolders()
    isUpdating.value = false
  }
}

function handleUnfavorite(keys: string[]) {
  if (actionsDisabled.value || !keys.length || !confirm(t('favorites.unfavorite_confirm', { count: keys.length })))
    return
  void runSelectedAction('unfavorite', keys)
}

function handleTransfer() {
  const action = transferAction.value
  const target = destinationFolders.value.find(folder => folder.id === targetFolderID.value)
  if (action && target)
    void runSelectedAction(action, [...selectedKeys.keys()], target.id)
}

async function runSelectedAction(action: SelectedAction, keys: string[], destinationID?: number) {
  const mediaID = selectedCategory.value?.id
  const csrf = getCSRF()
  const mid = getUserID()
  if (actionsDisabled.value || !mediaID || !csrf || !keys.length || (action !== 'unfavorite' && (!destinationID || !mid)))
    return

  isUpdating.value = true
  const batchSize = 20
  let completed = 0
  let unconfirmed: string[] = []
  try {
    for (let offset = 0; offset < keys.length; offset += batchSize) {
      if (!alive)
        break
      if (getCSRF() !== csrf || getUserID() !== mid)
        throw new Error('Favorite account changed')
      const batch = keys.slice(offset, offset + batchSize)
      unconfirmed = batch
      const resources = batch.join(',')
      const transferParams = { resources, src_media_id: mediaID, tar_media_id: destinationID, mid, csrf }
      const res = action === 'unfavorite'
        ? await api.favorite.patchDelFavoriteResources({ resources, media_id: mediaID, csrf })
        : await api.favorite[action === 'copy' ? 'copyFavoriteResources' : 'moveFavoriteResources'](transferParams)
      if (res?.code !== 0) {
        if (typeof res?.code === 'number')
          unconfirmed = []
        throw new Error(res?.message)
      }
      completed += batch.length
      batch.forEach(key => selectedKeys.delete(key))
      unconfirmed = []
    }
    if (alive) {
      closeBatchMode()
      if (action !== 'unfavorite')
        toast.success(t(action === 'copy' ? 'favorites.copy_success' : 'favorites.move_success', { count: completed }))
    }
  }
  catch {
    if (alive) {
      closeTransferDialog()
      unconfirmed.forEach(key => selectedKeys.delete(key))
      toast.error(t(unconfirmed.length ? 'favorites.batch_unconfirmed' : 'favorites.batch_failed', { completed, count: keys.length }))
    }
  }
  finally {
    if (alive && getUserID() === mid && getCSRF() === csrf && (completed > 0 || unconfirmed.length > 0)) {
      reconciliation.value = { source: action !== 'copy' || unconfirmed.length > 0, destination: destinationID }
      await reconcileFolders()
    }
    isUpdating.value = false
  }
}

async function reconcileFolders() {
  const affected = reconciliation.value
  if (!affected)
    return
  try {
    if (!getCSRF())
      throw new Error('Favorite session expired')
    if (affected.source) {
      // 从第一页刷新，避免删除后沿用已偏移的分页。
      handleBackToTop()
      await reset()
      if (loadFailed.value)
        throw new Error('Could not refresh source folder')
    }
    if (affected.destination !== undefined) {
      const categories = await fetchCategories()
      if (alive)
        favoriteCategories.value = categories
    }
    reconciliation.value = undefined
  }
  catch {
    if (alive)
      toast.error(t('favorites.refresh_failed'))
  }
}

async function retryReconciliation() {
  if (isUpdating.value)
    return
  isUpdating.value = true
  try {
    await reconcileFolders()
  }
  finally {
    isUpdating.value = false
  }
}

function isMusic(item: FavoriteItem) {
  return item.link.includes('bilibili://music')
}

function favoriteUploaderMid(item: FavoriteItem) {
  if (!isMusic(item) && item.bvid)
    return item.upper?.mid
}
</script>

<template>
  <div v-if="getCSRF()" flex="~ col md:row lg:row" gap-6>
    <main w="full md:60% lg:70% xl:75%" order="2 md:1" min-w-0 relative>
      <div
        class="favorites-toolbar"
        :class="{ 'favorites-toolbar--raised': shouldMoveCtrlBarUp }"
        sticky z-10 mb-3
        flex="~ wrap items-start justify-between gap-x-4 gap-y-2"
      >
        <div
          flex="~ items-center gap-2"
          min-w-0 max-w-full p-2
          bg="$bew-elevated-solid" rounded="$bew-radius" shadow="$bew-shadow-2"
        >
          <Input
            v-model="keyword"
            class="favorites-search"
            :placeholder="searchLabel"
            :aria-label="searchLabel"
            :disabled="actionsDisabled || categoriesLoading || !activeCategory"
            @enter="handleSearch"
          />
          <Button type="primary" :aria-label="searchLabel" :disabled="actionsDisabled || categoriesLoading || !activeCategory" @click="handleSearch">
            <div i-tabler:search aria-hidden="true" />
          </Button>
        </div>
        <div
          v-if="!browseSaved"
          flex="~ wrap items-center justify-end gap-2"
          ml-auto max-w-full self-center
          :aria-busy="isUpdating"
        >
          <template v-if="batchMode">
            <span text="sm $bew-text-2" aria-live="polite">{{ t('favorites.selected_count', { count: selectedKeys.size }) }}</span>
            <Button size="small" :disabled="actionsDisabled || !favoriteResources.length" @click="toggleLoadedSelection">
              {{ t(allLoadedSelected ? 'favorites.deselect_loaded' : 'favorites.select_loaded') }}
            </Button>
            <Button size="small" :disabled="actionsDisabled || !selectedKeys.size || !destinationFolders.length" @click="openTransferDialog('copy')">
              {{ t('favorites.copy_to') }}
            </Button>
            <Button size="small" :disabled="actionsDisabled || !selectedKeys.size || !destinationFolders.length" @click="openTransferDialog('move')">
              {{ t('favorites.move_to') }}
            </Button>
            <Button size="small" type="error" :disabled="actionsDisabled || !selectedKeys.size" @click="handleUnfavorite([...selectedKeys.keys()])">
              {{ t('favorites.unfavorite') }}
            </Button>
            <Button size="small" :disabled="actionsDisabled || !selectedCategory" @click="handleClean">
              {{ t('favorites.clean_invalid') }}
            </Button>
            <Button size="small" type="tertiary" :disabled="actionsDisabled" @click="closeBatchMode">
              {{ t('common.operation.cancel') }}
            </Button>
          </template>
          <Button
            v-else
            type="secondary"
            :disabled="actionsDisabled || !selectedCategory"
            @click="batchMode = true"
          >
            {{ t('favorites.batch_manage') }}
          </Button>
        </div>
      </div>
      <Button v-if="reconciliation && !isUpdating" @click="retryReconciliation">
        {{ t('common.retry') }}
      </Button>
      <Button v-else-if="categoriesFailed" @click="initData">
        {{ $t('common.retry') }}
      </Button>
      <Button v-else-if="loadFailed" :disabled="actionsDisabled" @click="load">
        {{ $t('common.retry') }}
      </Button>
      <Empty v-if="favoriteResources.length === 0 && !isFullPageLoading" mb-6 :description="browseSaved && savedCategories?.length === 0 ? t('favorites.no_saved_categories') : undefined" />
      <template v-else>
        <Transition name="fade">
          <Loading v-if="isFullPageLoading" w-full h-full pos="absolute top-0 left-0" mt--50px />
        </Transition>
        <!-- favorite list -->
        <VirtualFeed
          v-if="!categoriesLoading && !categoriesFailed"
          :items="favoriteResources" :item-key="favoriteKey"
          layout="adaptive" :column-offset="1" mb-6
        >
          <template #default="{ item, index }">
            <div relative>
              <div :inert="batchMode">
                <VideoCard
                  :cover-loading="index < 8 ? 'eager' : 'lazy'"
                  reserve-title-space
                  :uploader-block="!isMusic(item)"
                  :video="{
                    id: item.id,
                    duration: item.duration,
                    title: item.title,
                    cover: item.cover,
                    author: {
                      name: item.upper.name,
                      authorFace: item.upper.face,
                      mid: item.upper.mid,
                    },
                    view: item.cnt_info.play,
                    danmaku: item.cnt_info.danmaku,
                    publishedTimestamp: item.pubtime,
                    bvid: isMusic(item) ? undefined : item.bvid,
                    url: isMusic(item) ? `https://www.bilibili.com/audio/au${item.id}` : undefined,
                  }"
                  group
                >
                  <template v-if="!browseSaved && !batchMode" #coverTopLeft>
                    <button
                      p="x-2 y-1" m="1"
                      rounded="$bew-radius"
                      text="!white xl"
                      bg="black opacity-60 hover:$bew-error-color-80"
                      :aria-label="t('favorites.unfavorite')"
                      :disabled="actionsDisabled"
                      @click.prevent.stop="handleUnfavorite([favoriteKey(item)])"
                    >
                      <Tooltip :content="$t('favorites.unfavorite')" placement="bottom" type="dark">
                        <div i-ic-baseline-clear />
                      </Tooltip>
                    </button>
                  </template>
                </VideoCard>
              </div>
              <button
                v-if="batchMode"
                type="button"
                class="favorite-selection"
                :aria-label="item.title"
                :aria-pressed="selectedKeys.has(favoriteKey(item))"
                :disabled="actionsDisabled"
                @click="toggleSelection(item)"
              >
                <span class="favorite-selection-indicator" aria-hidden="true">
                  <span v-if="selectedKeys.has(favoriteKey(item))" i-tabler:check />
                </span>
              </button>
            </div>
          </template>
        </VirtualFeed>

        <Button v-if="windowFull" class="my-4" :disabled="actionsDisabled" @click="continueWindow">
          {{ $t('common.continue_browsing') }}
        </Button>
        <!-- no more content -->
        <Empty v-if="noMoreContent" class="py-4" :description="$t('common.no_more_content')" />

        <!-- loading -->
        <Transition name="fade">
          <Loading
            v-if="isLoading && favoriteResources.length !== 0 && !noMoreContent"
            m="-t-4"
          />
        </Transition>
      </template>
      <Button
        v-if="activeCategory && !favoriteResources.length && !isFullPageLoading && !loadFailed && !noMoreContent"
        :disabled="actionsDisabled"
        @click="windowFull ? continueWindow() : load()"
      >
        {{ $t('video_card.load_more') }}
      </Button>
    </main>

    <aside relative min-w-0 w="full md:40% lg:30% xl:25%" order="1 md:2">
      <div
        class="md:sticky md:top-120px md:my-10"
        w-full h="auto md:[calc(100vh-160px)]"
        rounded="$bew-radius"
        overflow-hidden
      >
        <!-- Frosted Glass Cover -->
        <div
          pos="absolute top-0 left-0" w-full h-full
          z--1 class="hidden md:block"
        >
          <div
            absolute w-full h-full
            bg="$bew-fill-4"
          />
          <img
            v-if="categoryCover"
            :src="removeHttpFromUrl(`${categoryCover}@480w_270h_1c`)"
            w-full h-full object="cover center" blur-40px
            relative z--1
          >
        </div>

        <!-- Content -->
        <div
          class="md:absolute md:top-0 md:left-0 md:p-6"
          w-full h-full
          overflow-overlay
          flex="~ col gap-4 justify-start"
        >
          <picture
            rounded="$bew-radius" style="box-shadow: 0 16px 24px -12px rgba(0, 0, 0, .36)"
            aspect-video mb-4 bg="$bew-skeleton"
            class="hidden md:block"
          >
            <img
              v-if="categoryCover" :src="removeHttpFromUrl(`${categoryCover}@480w_270h_1c`)"
              rounded="$bew-radius" aspect-video w-full object-cover
            >
            <div v-else aspect-video w-full>
              <!-- <Empty /> -->
            </div>
          </picture>

          <h3 class="hidden md:block" text="3xl white" fw-600 style="text-shadow: 0 0 12px rgba(0,0,0,.3)">
            {{ activeCategory?.title }}
          </h3>
          <div class="category-actions">
            <Button
              class="category-action" block center
              :disabled="categoriesLoading || !activeCategory?.media_count"
              @click="handlePlayAll"
            >
              <template #left>
                <div i-tabler:player-play aria-hidden="true" />
              </template>
              <span truncate>{{ t('common.play_all') }}</span>
            </Button>
            <Button
              class="category-action" block center
              :disabled="categoriesLoading || actionsDisabled"
              :aria-label="t(browseSaved ? 'favorites.show_own_folders' : 'favorites.show_saved_categories')"
              :title="t(browseSaved ? 'favorites.show_own_folders' : 'favorites.show_saved_categories')"
              :aria-pressed="browseSaved"
              @click="toggleSavedMode"
            >
              <span truncate>{{ t(browseSaved ? 'favorites.own_short' : 'favorites.saved_short') }}</span>
            </Button>
          </div>
          <draggable
            tag="ul"
            class="category-list"
            :aria-label="sidebarLabel"
            :model-value="sidebarCategories"
            :item-key="categoryKey"
            :disabled="!canReorder"
            :force-fallback="true"
            :fallback-tolerance="4"
            :animation="140"
            handle=".category-drag-handle"
            ghost-class="category-row--dragged"
            @update:model-value="reorderSavedCategories"
          >
            <template #item="{ element: item }">
              <li
                class="category-row"
                :class="{ 'category-row--active': activeCategory && categoryKey(item) === categoryKey(activeCategory) }"
              >
                <button
                  v-if="!browseSaved && 'attr' in item"
                  type="button"
                  class="category-privacy"
                  :class="{
                    'category-privacy--private': isPrivateFolder(item),
                    'category-privacy--armed': armedPrivacy?.id === item.id,
                    'category-privacy--saving': savingPrivacy === item.id,
                  }"
                  :aria-label="privacyLabel(item)"
                  :title="privacyLabel(item)"
                  :disabled="actionsDisabled || categoriesLoading"
                  @click="handlePrivacy(item)"
                  @keydown.esc.stop="cancelPrivacy"
                >
                  <span v-if="savingPrivacy === item.id" i-tabler:loader-2 aria-hidden="true" />
                  <span v-else-if="armedPrivacy?.id === item.id" i-tabler:check aria-hidden="true" />
                  <span v-else-if="isPrivateFolder(item)" i-tabler:lock aria-hidden="true" />
                  <span v-else i-tabler:lock-open aria-hidden="true" />
                </button>
                <button
                  v-else
                  type="button"
                  class="category-drag-handle"
                  :aria-label="t('favorites.reorder_category', { title: item.title })"
                  :title="t('favorites.reorder_category', { title: item.title })"
                  :aria-disabled="!canReorder"
                  @click.stop
                  @keydown.up.prevent.stop="moveSavedCategory(item, -1)"
                  @keydown.left.prevent.stop="moveSavedCategory(item, -1)"
                  @keydown.down.prevent.stop="moveSavedCategory(item, 1)"
                  @keydown.right.prevent.stop="moveSavedCategory(item, 1)"
                >
                  <span i-tabler:grip-vertical aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="category-button"
                  :aria-current="activeCategory && categoryKey(item) === categoryKey(activeCategory) ? 'true' : undefined"
                  :disabled="actionsDisabled || categoriesLoading"
                  @click="'attr' in item ? changeCategory(item) : changeSavedCategory(item)"
                >
                  <span>{{ item.title }}</span>
                  <span class="category-count">{{ item.media_count }}</span>
                </button>
              </li>
            </template>
          </draggable>
        </div>
      </div>
    </aside>

    <Dialog
      v-if="transferAction"
      append-to-bewly-body
      :title="t(transferAction === 'copy' ? 'favorites.copy_to' : 'favorites.move_to')"
      :desc="t('favorites.selected_count', { count: selectedKeys.size })"
      max-width="calc(100vw - 2rem)"
      content-max-height="min(50dvh, 360px)"
      :loading="isUpdating"
      :confirm-disabled="targetFolderID === undefined"
      @confirm="handleTransfer"
      @close="closeTransferDialog"
    >
      <fieldset m-0 p-0 border-none>
        <legend mb-2 text="sm $bew-text-2">
          {{ t('favorites.target_folder') }}
        </legend>
        <label
          v-for="folder in destinationFolders"
          :key="folder.id"
          flex="~ items-center gap-3"
          rounded="$bew-radius"
          p="x-2 y-2"
          bg="hover:$bew-fill-2"
          cursor-pointer
        >
          <input
            v-model="targetFolderID"
            name="favorite-destination"
            type="radio"
            :value="folder.id"
            :disabled="actionsDisabled"
            style="accent-color: var(--bew-theme-color)"
            shrink-0
          >
          <span break-anywhere>{{ folder.title }}</span>
        </label>
      </fieldset>
    </Dialog>
  </div>
  <Empty v-else mt-6 :description="t('common.please_log_in_first')">
    <Button type="primary" @click="jumpToLoginPage()">
      {{ $t('common.login') }}
    </Button>
  </Empty>
</template>

<style lang="scss" scoped>
.favorites-toolbar {
  top: calc(var(--bew-top-bar-height) + 10px);
  transition: top 250ms ease;

  &--raised {
    top: 8px;
  }

  :deep(.favorites-search) {
    width: 15rem;
    min-width: 0;
  }
}

.favorite-selection {
  position: absolute;
  inset: 0;
  border-radius: var(--bew-radius);
  cursor: pointer;

  &:focus-visible,
  &[aria-pressed="true"] {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: -2px;
  }

  &[aria-pressed="true"] .favorite-selection-indicator {
    background: var(--bew-theme-color);
  }
}

.favorite-selection-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid white;
  border-radius: 6px;
  background: rgb(0 0 0 / 60%);
  color: white;
}

.category-list {
  display: flex;
  gap: 6px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.35);
    border-radius: 20px;
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }
}

.category-actions {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 6px;
}

.category-row {
  display: flex;
  align-items: stretch;
  border-radius: var(--bew-radius);
  background: var(--bew-fill-1);

  &:hover,
  &:focus-within,
  &--active {
    background: var(--bew-fill-3);
  }
}

.category-privacy {
  display: grid;
  place-items: center;
  border-radius: var(--bew-radius);

  span {
    opacity: 0;
  }

  &--private span,
  &--armed span,
  &--saving span,
  &:hover span,
  &:focus-visible span {
    opacity: 1;
  }

  &:hover,
  &--armed {
    background: var(--bew-fill-3);
  }

  &--armed {
    color: var(--bew-theme-color);
  }
}

.category-privacy,
.category-drag-handle {
  flex: 0 0 34px;
}

.category-drag-handle {
  display: grid;
  place-items: center;
  border-radius: var(--bew-radius);
  touch-action: none;

  span {
    opacity: 0.7;
  }

  &[aria-disabled="false"] {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  &:hover span,
  &:focus-visible span {
    opacity: 1;
  }
}

.category-row--dragged {
  opacity: 0.4;
}

.category-button {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 8px;
  padding-block: 6px;
  padding-inline: 0 12px;
  border-radius: var(--bew-radius);
  white-space: nowrap;
  text-align: start;
}

.category-button,
.category-privacy,
.category-drag-handle {
  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }
}

.category-count {
  opacity: 0.65;
}

@media (min-width: 768px) {
  .category-list {
    display: block;
    min-height: 0;
    border: 1px solid rgb(255 255 255 / 20%);
    border-radius: var(--bew-radius);
    scrollbar-width: none;
  }

  .category-action {
    color: white;
    background: rgb(255 255 255 / 24%);
    padding-inline: 8px;
  }

  .category-row {
    border-radius: 0;
    background: transparent;
    color: white;

    &:hover,
    &:focus-within,
    &--active {
      background: rgb(255 255 255 / 35%);
    }

    & + & {
      border-top: 1px solid rgb(255 255 255 / 20%);
    }
  }

  .category-button {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>
