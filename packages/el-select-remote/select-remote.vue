<template>
  <div
    :class="[selectSize ? 'el-select--' + selectSize : '']"
    @click.stop="toggleMenu"
    class="el-select el-select-remote"
    v-clickoutside="handleClose">
    <div
      :style="{ 'max-width': inputWidth - 32 + 'px', width: '100%' }"
      class="el-select__tags"
      ref="tags"
      v-if="multiple">
      <span v-if="collapseTags && selected.length">
        <el-tag
          :closable="!selectDisabled"
          :hit="selected[0].hitState"
          :size="collapseTagSize"
          @close="deleteTag($event, selected[0])"
          disable-transitions
          type="info">
          <span class="el-select__tags-text">{{ selected[0].currentLabel }}</span>
        </el-tag>
        <el-tag
          :closable="false"
          :size="collapseTagSize"
          disable-transitions
          type="info"
          v-if="selected.length > 1">
          <span class="el-select__tags-text">+ {{ selected.length - 1 }}</span>
        </el-tag>
      </span>
      <transition-group @after-leave="resetInputHeight" v-if="!collapseTags">
        <el-tag
          :closable="!selectDisabled"
          :hit="item.hitState"
          :key="getValueKey(item)"
          :size="collapseTagSize"
          @close="deleteTag($event, item)"
          disable-transitions
          type="info"
          v-for="item in selected">
          <span class="el-select__tags-text">{{ item.currentLabel }}</span>
        </el-tag>
      </transition-group>

      <input
        :autocomplete="autoComplete || autocomplete"
        :class="[selectSize ? `is-${ selectSize }` : '']"
        :disabled="selectDisabled"
        :style="{ 'flex-grow': '1', width: inputLength / (inputWidth - 32) + '%', 'max-width': inputWidth - 42 + 'px' }"
        @blur="softFocus = false"
        @click.stop
        @compositionend="handleComposition"
        @compositionstart="handleComposition"
        @compositionupdate="handleComposition"
        @focus="handleFocus"
        @input="debouncedQueryChange"
        @keydown="resetInputState"
        @keydown.delete="deletePrevTag"
        @keydown.down.prevent="navigateOptions('next')"
        @keydown.enter.prevent="selectOption"
        @keydown.esc.stop.prevent="visible = false"
        @keydown.up.prevent="navigateOptions('prev')"
        @keyup="managePlaceholder"
        class="el-select__input"
        ref="input"
        type="text"
        v-if="filterable"
        v-model="query">
    </div>
    <el-input
      :autocomplete="autoComplete || autocomplete"
      :class="{ 'is-focus': visible }"
      :disabled="selectDisabled"
      :id="id"
      :name="name"
      :placeholder="currentPlaceholder"
      :readonly="readonly"
      :size="selectSize"
      :validate-event="false"
      @blur="handleBlur"
      @focus="handleFocus"
      @keydown.native.down.stop.prevent="navigateOptions('next')"
      @keydown.native.enter.prevent="selectOption"
      @keydown.native.esc.stop.prevent="visible = false"
      @keydown.native.tab="visible = false"
      @keydown.native.up.stop.prevent="navigateOptions('prev')"
      @keyup.native="debouncedOnInputChange"
      @mouseenter.native="inputHovering = true"
      @mouseleave.native="inputHovering = false"
      @paste.native="debouncedOnInputChange"
      ref="reference"
      type="text"
      v-model="selectedLabel">
      <template slot="prefix" v-if="$slots.prefix">
        <slot name="prefix"></slot>
      </template>
      <template slot="suffix">
        <i :class="['el-select__caret', 'el-input__icon', 'el-icon-' + iconClass]" v-show="!showClose"></i>
        <i @click="handleClearClick" class="el-select__caret el-input__icon el-icon-circle-close" v-if="showClose"></i>
      </template>
    </el-input>
    <transition
      @after-leave="doDestroy"
      @before-enter="handleMenuEnter"
      name="el-zoom-in-top">
      <el-select-menu
        :append-to-body="popperAppendToBody"
        ref="popper"
        v-show="visible && emptyText !== false">
        <el-scrollbar
          :class="{ 'is-empty': !allowCreate && query && filteredOptionsCount === 0 }"
          ref="scrollbar"
          tag="ul"
          v-show="options.length > 0 && !loading"
          view-class="el-select-dropdown__list"
          wrap-class="el-select-dropdown__wrap">
          <el-select-option
            :value="query"
            created
            v-if="showNewOption">
          </el-select-option>
          <slot :options="remoteOptions">
            <el-option
              :key="item[valueKey]"
              :label="item[nameKey]"
              :value="item[valueKey]"
              v-for="item in remoteOptions">
            </el-option>
          </slot>
        </el-scrollbar>
        <template v-if="emptyText && (!allowCreate || loading || (allowCreate && options.length === 0 ))">
          <slot name="empty" v-if="$slots.empty"></slot>
          <p class="el-select-dropdown__empty" v-else>
            {{ emptyText }}
          </p>
        </template>
        <el-pagination
          :current-page.sync="pagingInfo.currentPage"
          :page-size="pagingInfo.pageSize"
          :total="pagingInfo.totalRecord"
          @current-change="handleCurrentChange"
          class="el-select-remote-paging"
          hide-on-single-page
          layout="prev, slot, next">
          <span>{{ pagingInfo.currentPage + ' / ' + pagingInfo.totalPage }}</span>
        </el-pagination>
      </el-select-menu>
    </transition>
  </div>
</template>

<script type="text/babel">
import Emitter from 'element-ui/src/mixins/emitter'
import Focus from 'element-ui/src/mixins/focus'
import Locale from 'element-ui/src/mixins/locale'
import ElSelectMenu from 'element-ui/packages/select/src/select-dropdown'
// import ElOption from 'element-ui/packages/select/src/option'
import debounce from 'throttle-debounce/debounce'
import Clickoutside from 'element-ui/src/utils/clickoutside'
import { addResizeListener, removeResizeListener } from 'element-ui/src/utils/resize-event'
import { t } from 'element-ui/src/locale'
import scrollIntoView from 'element-ui/src/utils/scroll-into-view'
import { getValueByPath } from 'element-ui/src/utils/util'
import { valueEquals, isIE, isEdge } from 'element-ui/src/utils/util'
import NavigationMixin from 'element-ui/packages/select/src/navigation-mixin'
import { isKorean } from 'element-ui/src/utils/shared'
import axios from '@/plugins/axios'

export default {
  mixins: [Emitter, Locale, Focus('reference'), NavigationMixin],

  name: 'ElSelectRemote',

  componentName: 'ElSelect',

  inject: {
    elForm: {
      default: ''
    },

    elFormItem: {
      default: ''
    }
  },

  provide() {
    return {
      'select': this
    }
  },

  directives: { Clickoutside },

  components: {
    // ElOption,
    ElSelectMenu
  },

  props: {
    name: String,
    id: String,
    value: {
      required: true
    },
    autocomplete: {
      type: String,
      default: 'off'
    },
    /** @Deprecated in next major version */
    autoComplete: {
      type: String,
      validator(val) {
        process.env.NODE_ENV !== 'production' &&
        console.warn('[Element Warn][Select]\'auto-complete\' property will be deprecated in next major version. please use \'autocomplete\' instead.')
        return true
      }
    },
    automaticDropdown: Boolean,
    size: String,
    disabled: Boolean,
    clearable: Boolean,
    filterable: {
      type: Boolean,
      default: true
    },
    allowCreate: Boolean,
    loading: Boolean,
    popperClass: String,
    remote: {
      type: Boolean,
      default: true
    },
    loadingText: String,
    noMatchText: String,
    noDataText: String,
    remoteMethod: {
      type: Function,
      default() {
        this.pagingInfo.currentPage = 1
        this.fetchData()
      }
    },
    filterMethod: Function,
    multiple: Boolean,
    multipleLimit: {
      type: Number,
      default: 0
    },
    placeholder: {
      type: String,
      default() {
        return t('el.select.placeholder')
      }
    },
    defaultFirstOption: Boolean,
    reserveKeyword: Boolean,
    valueKey: {
      type: String,
      default: 'id'
    },
    nameKey: {
      type: String,
      default: 'name'
    },
    collapseTags: Boolean,
    popperAppendToBody: {
      type: Boolean,
      default: true
    },
    url: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      remoteOptions: [],
      options: [],
      cachedOptions: [],
      createdLabel: null,
      createdSelected: false,
      selected: this.multiple ? [] : {},
      inputLength: 20,
      inputWidth: 0,
      initialInputHeight: 0,
      cachedPlaceHolder: '',
      optionsCount: 0,
      filteredOptionsCount: 0,
      visible: false,
      softFocus: false,
      selectedLabel: '',
      hoverIndex: -1,
      query: '',
      previousQuery: null,
      inputHovering: false,
      currentPlaceholder: '',
      menuVisibleOnFocus: false,
      isOnComposition: false,
      isSilentBlur: false,
      pagingInfo: {
        currentPage: 1,
        totalRecord: 0,
        totalPage: 1,
        pageSize: 10
      }
    }
  },

  computed: {
    _elFormItemSize() {
      return (this.elFormItem || {}).elFormItemSize
    },

    readonly() {
      return !this.filterable || this.multiple || (!isIE() && !isEdge() && !this.visible)
    },

    showClose() {
      let hasValue = this.multiple
        ? Array.isArray(this.value) && this.value.length > 0
        : this.value !== undefined && this.value !== null && this.value !== ''
      let criteria = this.clearable &&
        !this.selectDisabled &&
        this.inputHovering &&
        hasValue
      return criteria
    },

    iconClass() {
      return (this.visible ? 'arrow-up is-reverse' : 'arrow-up')
    },

    debounce() {
      return this.remote ? 300 : 0
    },

    emptyText() {
      if (this.loading) {
        return this.loadingText || this.t('el.select.loading')
      } else {
        if (this.remote && this.query === '' && this.options.length === 0) return false
        if (this.filterable && this.query && this.options.length > 0 && this.filteredOptionsCount === 0) {
          return this.noMatchText || this.t('el.select.noMatch')
        }
        if (this.options.length === 0) {
          return this.noDataText || this.t('el.select.noData')
        }
      }
      return null
    },

    showNewOption() {
      let hasExistingOption = this.options.filter(option => !option.created)
      .some(option => option.currentLabel === this.query)
      return this.filterable && this.allowCreate && this.query !== '' && !hasExistingOption
    },

    selectSize() {
      return this.size || this._elFormItemSize || (this.$ELEMENT || {}).size
    },

    selectDisabled() {
      return this.disabled || (this.elForm || {}).disabled
    },

    collapseTagSize() {
      return ['small', 'mini'].indexOf(this.selectSize) > -1
        ? 'mini'
        : 'small'
    }
  },

  watch: {
    selectDisabled() {
      this.$nextTick(() => {
        this.resetInputHeight()
      })
    },

    placeholder(val) {
      this.cachedPlaceHolder = this.currentPlaceholder = val
    },

    value(val, oldVal) {
      if (this.multiple) {
        this.resetInputHeight()
        if ((val && val.length > 0) || (this.$refs.input && this.query !== '')) {
          this.currentPlaceholder = ''
        } else {
          this.currentPlaceholder = this.cachedPlaceHolder
        }
        if (this.filterable && !this.reserveKeyword) {
          this.query = ''
          this.handleQueryChange(this.query)
        }
      }
      this.setSelected()
      if (this.filterable && !this.multiple) {
        this.inputLength = 20
      }
      if (!valueEquals(val, oldVal)) {
        this.dispatch('ElFormItem', 'el.form.change', val)
      }
    },

    visible(val) {
      if (!val) {
        this.broadcast('ElSelectDropdown', 'destroyPopper')
        if (this.$refs.input) {
          this.$refs.input.blur()
        }
        this.query = ''
        this.previousQuery = null
        this.selectedLabel = ''
        this.inputLength = 20
        this.menuVisibleOnFocus = false
        this.resetHoverIndex()
        this.$nextTick(() => {
          if (this.$refs.input &&
            this.$refs.input.value === '' &&
            this.selected.length === 0) {
            this.currentPlaceholder = this.cachedPlaceHolder
          }
        })
        if (!this.multiple) {
          if (this.selected) {
            if (this.filterable && this.allowCreate &&
              this.createdSelected && this.createdLabel) {
              this.selectedLabel = this.createdLabel
            } else {
              this.selectedLabel = this.selected.currentLabel
            }
            if (this.filterable) this.query = this.selectedLabel
          }

          if (this.filterable) {
            this.currentPlaceholder = this.cachedPlaceHolder
          }
        }
      } else {
        this.broadcast('ElSelectDropdown', 'updatePopper')
        if (this.filterable) {
          this.query = this.remote ? '' : this.selectedLabel
          this.handleQueryChange(this.query)
          if (this.multiple) {
            this.$refs.input.focus()
          } else {
            if (!this.remote) {
              this.broadcast('ElOption', 'queryChange', '')
              this.broadcast('ElOptionGroup', 'queryChange')
            }

            if (this.selectedLabel) {
              this.currentPlaceholder = this.selectedLabel
              this.selectedLabel = ''
            }
          }
        }
      }
      this.$emit('visible-change', val)
    },

    options() {
      if (this.$isServer) return
      this.$nextTick(() => {
        this.broadcast('ElSelectDropdown', 'updatePopper')
      })
      if (this.multiple) {
        this.resetInputHeight()
      }
      let inputs = this.$el.querySelectorAll('input')
      if ([].indexOf.call(inputs, document.activeElement) === -1) {
        this.setSelected()
      }
      if (this.defaultFirstOption && (this.filterable || this.remote) && this.filteredOptionsCount) {
        this.checkDefaultFirstOption()
      }
    }
  },

  methods: {
    handleComposition(event) {
      const text = event.target.value
      if (event.type === 'compositionend') {
        this.isOnComposition = false
        this.$nextTick(_ => this.handleQueryChange(text))
      } else {
        const lastCharacter = text[text.length - 1] || ''
        this.isOnComposition = !isKorean(lastCharacter)
      }
    },
    handleQueryChange(val) {
      if (this.previousQuery === val || this.isOnComposition) return
      if (
        this.previousQuery === null &&
        (typeof this.filterMethod === 'function' || typeof this.remoteMethod === 'function')
      ) {
        this.previousQuery = val
        return
      }
      this.previousQuery = val
      this.$nextTick(() => {
        if (this.visible) this.broadcast('ElSelectDropdown', 'updatePopper')
      })
      this.hoverIndex = -1
      if (this.multiple && this.filterable) {
        this.$nextTick(() => {
          const length = this.$refs.input.value.length * 15 + 20
          this.inputLength = this.collapseTags ? Math.min(50, length) : length
          this.managePlaceholder()
          this.resetInputHeight()
        })
      }
      if (this.remote && typeof this.remoteMethod === 'function') {
        this.hoverIndex = -1
        this.remoteMethod(val)
      } else if (typeof this.filterMethod === 'function') {
        this.filterMethod(val)
        this.broadcast('ElOptionGroup', 'queryChange')
      } else {
        this.filteredOptionsCount = this.optionsCount
        this.broadcast('ElOption', 'queryChange', val)
        this.broadcast('ElOptionGroup', 'queryChange')
      }
      if (this.defaultFirstOption && (this.filterable || this.remote) && this.filteredOptionsCount) {
        this.checkDefaultFirstOption()
      }
    },

    scrollToOption(option) {
      const target = Array.isArray(option) && option[0] ? option[0].$el : option.$el
      if (this.$refs.popper && target) {
        const menu = this.$refs.popper.$el.querySelector('.el-select-dropdown__wrap')
        scrollIntoView(menu, target)
      }
      this.$refs.scrollbar && this.$refs.scrollbar.handleScroll()
    },

    handleMenuEnter() {
      this.$nextTick(() => this.scrollToOption(this.selected))
    },

    emitChange(val) {
      if (!valueEquals(this.value, val)) {
        this.$emit('change', val)
      }
    },

    getOption(value) {
      let option
      const isObject = Object.prototype.toString.call(value).toLowerCase() === '[object object]'
      const isNull = Object.prototype.toString.call(value).toLowerCase() === '[object null]'
      const isUndefined = Object.prototype.toString.call(value).toLowerCase() === '[object undefined]'

      for (let i = this.cachedOptions.length - 1; i >= 0; i--) {
        const cachedOption = this.cachedOptions[i]
        const isEqual = isObject
          ? getValueByPath(cachedOption.value, this.valueKey) === getValueByPath(value, this.valueKey)
          : cachedOption.value === value
        if (isEqual) {
          option = cachedOption
          break
        }
      }
      if (option) return option
      const label = (!isObject && !isNull && !isUndefined)
        ? value : ''
      let newOption = {
        value: value,
        currentLabel: label
      }
      if (this.multiple) {
        newOption.hitState = false
      }
      return newOption
    },

    setSelected() {
      if (!this.multiple) {
        let option = this.getOption(this.value)
        if (option.created) {
          this.createdLabel = option.currentLabel
          this.createdSelected = true
        } else {
          this.createdSelected = false
        }
        this.selectedLabel = option.currentLabel
        this.selected = option
        if (this.filterable) this.query = this.selectedLabel
        return
      }
      let result = []
      if (Array.isArray(this.value)) {
        this.value.forEach(value => {
          result.push(this.getOption(value))
        })
      }
      this.selected = result
      this.$nextTick(() => {
        this.resetInputHeight()
      })
    },

    handleFocus(event) {
      if (!this.softFocus) {
        if (this.automaticDropdown || this.filterable) {
          this.visible = true
          this.menuVisibleOnFocus = true
        }
        this.$emit('focus', event)
      } else {
        this.softFocus = false
      }
    },

    blur() {
      this.visible = false
      this.$refs.reference.blur()
    },

    handleBlur(event) {
      setTimeout(() => {
        if (this.isSilentBlur) {
          this.isSilentBlur = false
        } else {
          this.$emit('blur', event)
        }
      }, 50)
      this.softFocus = false
    },

    handleClearClick(event) {
      this.deleteSelected(event)
    },

    doDestroy() {
      this.$refs.popper && this.$refs.popper.doDestroy()
    },

    handleClose() {
      this.visible = false
    },

    toggleLastOptionHitState(hit) {
      if (!Array.isArray(this.selected)) return
      const option = this.selected[this.selected.length - 1]
      if (!option) return

      if (hit === true || hit === false) {
        option.hitState = hit
        return hit
      }

      option.hitState = !option.hitState
      return option.hitState
    },

    deletePrevTag(e) {
      if (e.target.value.length <= 0 && !this.toggleLastOptionHitState()) {
        const value = this.value.slice()
        value.pop()
        this.$emit('input', value)
        this.emitChange(value)
      }
    },

    managePlaceholder() {
      if (this.currentPlaceholder !== '') {
        this.currentPlaceholder = this.$refs.input.value ? '' : this.cachedPlaceHolder
      }
    },

    resetInputState(e) {
      if (e.keyCode !== 8) this.toggleLastOptionHitState(false)
      this.inputLength = this.$refs.input.value.length * 15 + 20
      this.resetInputHeight()
    },

    resetInputHeight() {
      if (this.collapseTags && !this.filterable) return
      this.$nextTick(() => {
        if (!this.$refs.reference) return
        let inputChildNodes = this.$refs.reference.$el.childNodes
        let input = [].filter.call(inputChildNodes, item => item.tagName === 'INPUT')[0]
        const tags = this.$refs.tags
        const sizeInMap = this.initialInputHeight || 40
        input.style.height = this.selected.length === 0
          ? sizeInMap + 'px'
          : Math.max(
          tags ? (tags.clientHeight + (tags.clientHeight > sizeInMap ? 6 : 0)) : 0,
          sizeInMap
        ) + 'px'
        if (this.visible && this.emptyText !== false) {
          this.broadcast('ElSelectDropdown', 'updatePopper')
        }
      })
    },

    resetHoverIndex() {
      setTimeout(() => {
        if (!this.multiple) {
          this.hoverIndex = this.options.indexOf(this.selected)
        } else {
          if (this.selected.length > 0) {
            this.hoverIndex = Math.min.apply(null, this.selected.map(item => this.options.indexOf(item)))
          } else {
            this.hoverIndex = -1
          }
        }
      }, 300)
    },

    handleOptionSelect(option, byClick) {
      if (this.multiple) {
        const value = (this.value || []).slice()
        const optionIndex = this.getValueIndex(value, option.value)
        if (optionIndex > -1) {
          value.splice(optionIndex, 1)
        } else if (this.multipleLimit <= 0 || value.length < this.multipleLimit) {
          value.push(option.value)
        }
        this.$emit('input', value)
        this.emitChange(value)
        if (option.created) {
          this.query = ''
          this.handleQueryChange('')
          this.inputLength = 20
        }
        if (this.filterable) this.$refs.input.focus()
      } else {
        this.$emit('input', option.value)
        this.emitChange(option.value)
        this.visible = false
      }
      this.isSilentBlur = byClick
      this.setSoftFocus()
      if (this.visible) return
      this.$nextTick(() => {
        this.scrollToOption(option)
      })
    },

    setSoftFocus() {
      this.softFocus = true
      const input = this.$refs.input || this.$refs.reference
      if (input) {
        input.focus()
      }
    },

    getValueIndex(arr = [], value) {
      const isObject = Object.prototype.toString.call(value).toLowerCase() === '[object object]'
      if (!isObject) {
        return arr.indexOf(value)
      } else {
        const valueKey = this.valueKey
        let index = -1
        arr.some((item, i) => {
          if (getValueByPath(item, valueKey) === getValueByPath(value, valueKey)) {
            index = i
            return true
          }
          return false
        })
        return index
      }
    },

    toggleMenu() {
      if (!this.selectDisabled) {
        if (this.menuVisibleOnFocus) {
          this.menuVisibleOnFocus = false
        } else {
          this.visible = !this.visible
        }
        if (this.visible) {
          (this.$refs.input || this.$refs.reference).focus()
        }
      }
    },

    selectOption() {
      if (!this.visible) {
        this.toggleMenu()
      } else {
        if (this.options[this.hoverIndex]) {
          this.handleOptionSelect(this.options[this.hoverIndex])
        }
      }
    },

    deleteSelected(event) {
      event.stopPropagation()
      const value = this.multiple ? [] : ''
      this.$emit('input', value)
      this.emitChange(value)
      this.visible = false
      this.$emit('clear')
    },

    deleteTag(event, tag) {
      let index = this.selected.indexOf(tag)
      if (index > -1 && !this.selectDisabled) {
        const value = this.value.slice()
        value.splice(index, 1)
        this.$emit('input', value)
        this.emitChange(value)
        this.$emit('remove-tag', tag.value)
      }
      event.stopPropagation()
    },

    onInputChange() {
      if (this.filterable && this.query !== this.selectedLabel) {
        this.query = this.selectedLabel
        this.handleQueryChange(this.query)
      }
    },

    onOptionDestroy(index) {
      if (index > -1) {
        this.optionsCount--
        this.filteredOptionsCount--
        this.options.splice(index, 1)
      }
    },

    resetInputWidth() {
      this.inputWidth = this.$refs.reference.$el.getBoundingClientRect().width
    },

    handleResize() {
      this.resetInputWidth()
      if (this.multiple) this.resetInputHeight()
    },

    checkDefaultFirstOption() {
      this.hoverIndex = -1
      // highlight the created option
      let hasCreated = false
      for (let i = this.options.length - 1; i >= 0; i--) {
        if (this.options[i].created) {
          hasCreated = true
          this.hoverIndex = i
          break
        }
      }
      if (hasCreated) return
      for (let i = 0; i !== this.options.length; ++i) {
        const option = this.options[i]
        if (this.query) {
          // highlight first options that passes the filter
          if (!option.disabled && !option.groupDisabled && option.visible) {
            this.hoverIndex = i
            break
          }
        } else {
          // highlight currently selected option
          if (option.itemSelected) {
            this.hoverIndex = i
            break
          }
        }
      }
    },

    getValueKey(item) {
      if (Object.prototype.toString.call(item.value).toLowerCase() !== '[object object]') {
        return item.value
      } else {
        return getValueByPath(item.value, this.valueKey)
      }
    },

    handleCurrentChange() {
      this.fetchData()
    },

    fetchData() {
      return new Promise((resolve, reject) => {
        this.$emit('update:loading', true)
        axios.get(this.url, {
          params: {
            inputValue: this.query,
            ...this.pagingInfo
          }
        }).then(res => {
          if (res instanceof Array) { // 返回非分页数据
            this.remoteOptions = res
            this.pagingInfo.totalPage = 1
            this.pagingInfo.totalRecord = res.length
          } else {
            this.remoteOptions = res.records
            this.pagingInfo.totalPage = res.totalPage
            this.pagingInfo.totalRecord = res.totalRecord
          }
          this.$emit('update:loading', false)
          resolve(res)
        }).catch(error => {
          // this.remoteOptions = []
          this.$emit('update:loading', false)
          reject(error)
        })
      })
    }
  },

  created() {
    this.cachedPlaceHolder = this.currentPlaceholder = this.placeholder
    if (this.multiple && !Array.isArray(this.value)) {
      this.$emit('input', [])
    }
    if (!this.multiple && Array.isArray(this.value)) {
      this.$emit('input', '')
    }

    this.debouncedOnInputChange = debounce(this.debounce, () => {
      this.onInputChange()
    })

    this.debouncedQueryChange = debounce(this.debounce, (e) => {
      this.handleQueryChange(e.target.value)
    })

    this.$on('handleOptionClick', this.handleOptionSelect)
    this.$on('setSelected', this.setSelected)
  },

  mounted() {
    if (this.multiple && Array.isArray(this.value) && this.value.length > 0) {
      this.currentPlaceholder = ''
    }
    addResizeListener(this.$el, this.handleResize)

    const reference = this.$refs.reference
    if (reference && reference.$el) {
      const sizeMap = {
        medium: 36,
        small: 32,
        mini: 28
      }
      const input = reference.$el.querySelector('input')
      this.initialInputHeight = input.getBoundingClientRect().height || sizeMap[this.selectSize]
    }
    if (this.remote && this.multiple) {
      this.resetInputHeight()
    }
    this.$nextTick(() => {
      if (reference && reference.$el) {
        this.inputWidth = reference.$el.getBoundingClientRect().width
      }
    })
    this.fetchData().then(res => {
      this.setSelected()
    })
  },

  beforeDestroy() {
    if (this.$el && this.handleResize) removeResizeListener(this.$el, this.handleResize)
  }
}
</script>
