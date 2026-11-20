<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import Dialog from '~/components/Dialog.vue'
import type { FavoriteCategory, FavoriteResource } from '~/components/TopBar/types'
import VirtualFeed from '~/components/VirtualFeed.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useWindowedFeed } from '~/composables/useWindowedFeed'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import type { FavoritesResult, Media as FavoriteItem } from '~/models/video/favorite'
import type { FavoritesCategoryResult, List as CategoryItem } from '~/models/video/favoriteCategory'
import api from '~/utils/api'
import { getCSRF, getUserID, openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'
import emitter from '~/utils/mitt'

const { t } = useI18n()
const toast = useToast()

type TransferAction = 'copy' | 'move'
type SelectedAction = 'unfavorite' | TransferAction

const favoriteCategories = shallowRef<CategoryItem[]>([])
const selectedCategory = ref<FavoriteCategory>()
const activatedCategoryCover = ref('')
const shouldMoveCtrlBarUp = ref(false)
const keyword = ref('')
const categoriesLoading = ref(false)
const categoriesFailed = ref(false)
const batchMode = ref(false)
const selectedKeys = reactive(new Set<string>())
const isUpdating = ref(false)
const transferAction = ref<TransferAction>()
const targetFolderID = ref<number>()
const destinationFolders = computed(() => favoriteCategories.value.filter(folder => folder.id !== selectedCategory.value?.id))
const { handleBackToTop } = useBewlyApp()
let currentPageNum = 1
let query = ''
let alive = true
let categoryGeneration = 0

const {
  items: favoriteResources,
  isLoading,
  noMoreContent,
  loadFailed,
  windowFull,
  load,
  reset,
  continueWindow,
} = useWindowedFeed<FavoriteItem>({
  key: favoriteKey,
  scrollTarget: () => 0,
  beforeLoading: () => {},
  afterLoading: () => {},
  resetCursor: () => {
    currentPageNum = 1
    if (!isUpdating.value)
      selectedKeys.clear()
  },
  loadPage: async (current) => {
    const category = selectedCategory.value
    if (!category)
      return { items: [], done: true }
    const res: FavoritesResult = await api.favorite.getFavoriteResources({
      media_id: category.id,
      pn: currentPageNum,
      keyword: query,
    })
    if (!current())
      return { items: [], done: true }
    if (res.code !== 0)
      throw new Error(res.message)
    currentPageNum++
    activatedCategoryCover.value = res.data.info.cover
    favoriteCategories.value = favoriteCategories.value.map(item => item.id === category.id && item.media_count !== res.data.info.media_count
      ? { ...item, media_count: res.data.info.media_count }
      : item)
    const items = res.data.medias ?? []
    return { items, done: !items.length || res.data.has_more === false }
  },
})
const isFullPageLoading = computed(() => categoriesLoading.value || (isLoading.value && !favoriteResources.value.length))
const allLoadedSelected = computed(() => favoriteResources.value.length > 0 && favoriteResources.value.every(item => selectedKeys.has(favoriteKey(item))))

function favoriteKey(item: FavoriteResource) {
  return `${item.id}:${item.type}`
}

function toggleSelection(key: string) {
  if (selectedKeys.has(key))
    selectedKeys.delete(key)
  else
    selectedKeys.add(key)
}

function toggleLoadedSelection() {
  const deselect = allLoadedSelected.value
  for (const item of favoriteResources.value) {
    const key = favoriteKey(item)
    if (deselect)
      selectedKeys.delete(key)
    else
      selectedKeys.add(key)
  }
}

function closeBatchMode() {
  selectedKeys.clear()
  batchMode.value = false
  closeTransferDialog()
}

function openTransferDialog(action: TransferAction) {
  if (isUpdating.value || !selectedKeys.size || !destinationFolders.value.length)
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
onBeforeUnmount(() => {
  alive = false
  categoryGeneration++
  emitter.off(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibility)
})

async function initData() {
  const token = ++categoryGeneration
  categoriesLoading.value = true
  categoriesFailed.value = false
  try {
    const categories = await fetchCategories()
    if (!alive || token !== categoryGeneration)
      return
    favoriteCategories.value = categories
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

async function changeCategory(categoryItem: FavoriteCategory) {
  if (isUpdating.value)
    return
  closeBatchMode()
  selectedCategory.value = categoryItem
  activatedCategoryCover.value = ''
  query = ''
  keyword.value = ''
  handleBackToTop()
  await reset()
}

function handleSearch() {
  if (isUpdating.value)
    return
  query = keyword.value.trim()
  handleBackToTop()
  void reset()
}

function handlePlayAll() {
  openLinkToNewTab(`https://www.bilibili.com/list/ml${selectedCategory.value?.id}`)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

async function handleClean() {
  const folder = selectedCategory.value
  const csrf = getCSRF()
  if (isUpdating.value || !folder || !csrf || !confirm(t('favorites.clean_confirm', { folder: folder.title })))
    return

  isUpdating.value = true
  try {
    const res = await api.favorite.cleanFavoriteResources({ media_id: folder.id, csrf })
    if (res?.code !== 0)
      throw new Error(res?.message)
    if (alive) {
      closeBatchMode()
      toast.success(t('favorites.clean_success'))
      await reloadCurrentFolder()
    }
  }
  catch {
    if (alive)
      toast.error(t('favorites.clean_failed'))
  }
  finally {
    isUpdating.value = false
  }
}

function handleUnfavorite(keys: string[]) {
  if (isUpdating.value || !keys.length || !confirm(t('favorites.unfavorite_confirm', { count: keys.length })))
    return
  void runSelectedAction('unfavorite', keys)
}

function handleTransfer() {
  const action = transferAction.value
  const target = destinationFolders.value.find(folder => folder.id === targetFolderID.value)
  if (action && target)
    void runSelectedAction(action, [...selectedKeys], target.id)
}

async function runSelectedAction(action: SelectedAction, keys: string[], destinationID?: number) {
  const mediaID = selectedCategory.value?.id
  const csrf = getCSRF()
  const mid = getUserID()
  if (isUpdating.value || !mediaID || !csrf || !keys.length || (action !== 'unfavorite' && (!destinationID || !mid)))
    return

  isUpdating.value = true
  const batchSize = 20
  let completed = 0
  try {
    for (let offset = 0; offset < keys.length; offset += batchSize) {
      const batch = keys.slice(offset, offset + batchSize)
      const resources = batch.join(',')
      const transferParams = { resources, src_media_id: mediaID, tar_media_id: destinationID, mid, csrf }
      const res = action === 'unfavorite'
        ? await api.favorite.patchDelFavoriteResources({ resources, media_id: mediaID, csrf })
        : await api.favorite[action === 'copy' ? 'copyFavoriteResources' : 'moveFavoriteResources'](transferParams)
      if (res?.code !== 0)
        throw new Error(res?.message)
      completed += batch.length
      batch.forEach(key => selectedKeys.delete(key))
    }
    if (alive) {
      closeBatchMode()
      if (action !== 'unfavorite')
        toast.success(t(action === 'copy' ? 'favorites.copy_success' : 'favorites.move_success', { count: completed }))
    }
  }
  catch {
    if (alive)
      toast.error(t('favorites.batch_failed', { completed, count: keys.length }))
  }
  finally {
    if (alive && completed > 0) {
      await Promise.allSettled([
        action !== 'copy' && reloadCurrentFolder(),
        destinationID !== undefined && refreshDestinationCount(destinationID),
      ])
    }
    isUpdating.value = false
  }
}

async function reloadCurrentFolder() {
  // 服务端列表已变动，从第一页重新加载以免跳过条目。
  handleBackToTop()
  await reset()
}

async function refreshDestinationCount(destinationID: number) {
  const destination = (await fetchCategories()).find(folder => folder.id === destinationID)
  if (alive && destination) {
    favoriteCategories.value = favoriteCategories.value.map(folder => folder.id === destinationID ? destination : folder)
  }
}

function isMusic(item: FavoriteResource) {
  return item.link.includes('bilibili://music')
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
            :placeholder="t('favorites.search')"
            :aria-label="t('favorites.search')"
            :disabled="isUpdating"
            @enter="handleSearch"
          />
          <Button type="primary" :aria-label="t('favorites.search')" :disabled="isUpdating" @click="handleSearch">
            <div i-tabler:search aria-hidden="true" />
          </Button>
        </div>
        <div
          flex="~ wrap items-center justify-end gap-2"
          ml-auto max-w-full self-center
          :aria-busy="isUpdating"
        >
          <template v-if="batchMode">
            <span text="sm $bew-text-2" aria-live="polite">{{ t('favorites.selected_count', { count: selectedKeys.size }) }}</span>
            <Button size="small" :disabled="isUpdating || !favoriteResources.length" @click="toggleLoadedSelection">
              {{ t(allLoadedSelected ? 'favorites.deselect_loaded' : 'favorites.select_loaded') }}
            </Button>
            <Button size="small" :disabled="isUpdating || !selectedKeys.size || !destinationFolders.length" @click="openTransferDialog('copy')">
              {{ t('favorites.copy_to') }}
            </Button>
            <Button size="small" :disabled="isUpdating || !selectedKeys.size || !destinationFolders.length" @click="openTransferDialog('move')">
              {{ t('favorites.move_to') }}
            </Button>
            <Button size="small" type="error" :disabled="isUpdating || !selectedKeys.size" @click="handleUnfavorite([...selectedKeys])">
              {{ t('favorites.unfavorite') }}
            </Button>
            <Button size="small" :disabled="isUpdating || !selectedCategory" @click="handleClean">
              {{ t('favorites.clean_invalid') }}
            </Button>
            <Button size="small" type="tertiary" :disabled="isUpdating" @click="closeBatchMode">
              {{ t('common.operation.cancel') }}
            </Button>
          </template>
          <Button
            v-else
            type="secondary"
            :disabled="isUpdating || !selectedCategory"
            @click="batchMode = true"
          >
            {{ t('favorites.batch_manage') }}
          </Button>
        </div>
      </div>
      <Button v-if="categoriesFailed" @click="initData">
        {{ $t('common.retry') }}
      </Button>
      <Button v-else-if="loadFailed" :disabled="isUpdating" @click="load">
        {{ $t('common.retry') }}
      </Button>
      <Empty v-if="favoriteResources.length === 0 && !isFullPageLoading" mb-6 />
      <template v-else>
        <Transition name="fade">
          <Loading v-if="isFullPageLoading" w-full h-full pos="absolute top-0 left-0" mt--50px />
        </Transition>
        <!-- favorite list -->
        <VirtualFeed :items="favoriteResources" :item-key="favoriteKey" layout="adaptive" :column-offset="1" mb-6>
          <template #default="{ item, index }">
            <div relative>
              <div :inert="batchMode">
                <VideoCard
                  :cover-loading="index < 8 ? 'eager' : 'lazy'"
                  reserve-title-space
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
                  <template v-if="!batchMode" #coverTopLeft>
                    <button
                      p="x-2 y-1" m="1"
                      rounded="$bew-radius"
                      text="!white xl"
                      bg="black opacity-60 hover:$bew-error-color-80"
                      :aria-label="t('favorites.unfavorite')"
                      :disabled="isUpdating"
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
                :disabled="isUpdating"
                @click="toggleSelection(favoriteKey(item))"
              >
                <span class="favorite-selection-indicator" aria-hidden="true">
                  <span v-if="selectedKeys.has(favoriteKey(item))" i-tabler:check />
                </span>
              </button>
            </div>
          </template>
        </VirtualFeed>

        <Button v-if="windowFull" class="my-4" :disabled="isUpdating" @click="continueWindow">
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
    </main>

    <aside v-if="favoriteCategories.length" relative min-w-0 w="full md:40% lg:30% xl:25%" order="1 md:2">
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
            v-if="activatedCategoryCover"
            :src="removeHttpFromUrl(`${activatedCategoryCover}@480w_270h_1c`)"
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
              v-if="activatedCategoryCover" :src="removeHttpFromUrl(`${activatedCategoryCover}@480w_270h_1c`)"
              rounded="$bew-radius" aspect-video w-full object-cover
            >
            <div v-else aspect-video w-full>
              <!-- <Empty /> -->
            </div>
          </picture>

          <h3 class="hidden md:block" text="3xl white" fw-600 style="text-shadow: 0 0 12px rgba(0,0,0,.3)">
            {{ selectedCategory?.title }}
          </h3>
          <div class="hidden md:block">
            <Button
              color="rgba(255,255,255,.35)" block text-color="white" strong flex-1
              @click="handlePlayAll"
            >
              <template #left>
                <div i-tabler:player-play />
              </template>
              {{ t('common.play_all') }}
            </Button>
          </div>
          <ul
            class="category-list"
            :aria-label="t('favorites.folders')"
          >
            <li v-for="item in favoriteCategories" :key="item.id">
              <button
                type="button"
                class="category-button"
                :aria-current="item.id === selectedCategory?.id ? 'true' : undefined"
                :disabled="isUpdating"
                @click="changeCategory(item)"
              >
                <span>{{ item.title }}</span>
                <span class="category-count">{{ item.media_count }}</span>
              </button>
            </li>
          </ul>
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
            :disabled="isUpdating"
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

.category-button {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 12px;
  border-radius: var(--bew-radius);
  background: var(--bew-fill-1);
  white-space: nowrap;

  &:hover,
  &[aria-current="true"] {
    background: var(--bew-fill-3);
  }

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

  .category-button {
    border-bottom: 1px solid rgb(255 255 255 / 20%);
    border-radius: 0;
    background: transparent;
    color: white;
    white-space: normal;

    &:hover,
    &[aria-current="true"] {
      background: rgb(255 255 255 / 35%);
    }
  }
}
</style>
