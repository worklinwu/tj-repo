<template>
  <transition
    :name="animationName"
    @after-enter="afterEnter"
    @after-leave="afterLeave">
    <div
      @click.self="handleWrapperClick"
      class="ui-drawer__wrapper"
      v-show="visible">
      <div
        :aria-label="title || 'dialog'"
        :class="['ui-drawer-' + direction ,customClass]"
        :style="style"
        aria-modal="true"
        class="ui-drawer"
        ref="drawer"
        role="dialog">
        <div class="header">
          <i
            :class="[direction === 'left' ? 'el-icon-d-arrow-left' : 'el-icon-d-arrow-right' ]"
            @click="handleClose"
            aria-label="Close"
            class="icon"
            v-if="showClose"></i>
          <slot name="header">
            {{ title }}
          </slot>
        </div>
        <div class="footer" v-if="isShowFooter">
          <slot name="footer">
            <el-button
              @click="handleConfirm"
              type="primary"
              v-if="isShowConfirmButton">
              {{ this.confirmButtonText }}
            </el-button>
            <el-button
              @click="handleClose"
              v-if="isShowCancelButton">
              {{ this.cancelButtonText }}
            </el-button>
          </slot>
        </div>
        <div class="content" v-if="rendered">
          <slot></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
// 基于 ElementUI 扩展的UI组件, 满足项目特殊交付场景的类弹框组件

// 引用 ElementUI 的 popup 工具方法, 提供统一的遮罩层方案等等
import Popup from 'element-ui/src/utils/popup'
// 用于 当 ElDropdownMenu/ElSelectDropdown 处于展开状态时候, 在弹框时隐藏
import emitter from 'element-ui/src/mixins/emitter'

export default {
  name: 'ElDrawer', // 命名规则沿用 Element 的规范...
  mixins: [Popup, emitter],
  props: {
    // 标题
    title: {
      type: String,
      default: ''
    },
    // 弹框插入的位置
    appendToBody: {
      type: Boolean,
      default: false
    },
    // 是否显示关闭按钮
    showClose: {
      type: Boolean,
      default: true
    },
    // 自定义样式
    customClass: {
      type: String,
      default: ''
    },
    confirmButtonText: {
      type: String,
      default: '保存'
    },
    cancelButtonText: {
      type: String,
      default: '取消'
    },
    confirm: {
      type: Function
    },
    cancel: {
      type: Function
    },
    // 方向
    direction: {
      type: String,
      default: 'right',
      validator(value) {
        return ['left', 'right'].indexOf(value) !== -1
      }
    },
    // 距离边缘的距离
    sidesSpace: {
      type: String,
      default: '0'
    },
    // reset Popup prop
    modal: {
      type: Boolean,
      default: true
    },
    closeOnClickModal: {
      type: Boolean,
      default: true
    },
    closeOnPressEscape: {
      type: Boolean,
      default: true
    },
    lockScroll: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      closed: false
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.closed = false
        this.$emit('open')
        this.$el.addEventListener('scroll', this.updatePopper)
        this.$nextTick(() => {
          this.$refs.drawer.scrollTop = 0
        })
        if (this.appendToBody) {
          document.body.appendChild(this.$el)
        }
      } else {
        this.$el.removeEventListener('scroll', this.updatePopper)
        if (!this.closed) this.$emit('close')
      }
    }
  },
  computed: {
    // 是否显示保存按钮
    isShowConfirmButton() {
      return !!this.confirm && typeof this.confirm === 'function'
    },
    // 是否显示取消按钮
    isShowCancelButton() {
      return !!this.cancel && typeof this.cancel === 'function'
    },
    // 判断是否显示页脚
    isShowFooter() {
      return this.$slots.footer || this.isShowConfirmButton || this.isShowCancelButton
    },
    // 动画
    animationName() {
      return 'drawer-' + this.direction
    },
    style() {
      let style = {}
      if (this.sidesSpace) {
        if (this.direction === 'left') {
          style.right = this.sidesSpace
        } else {
          style.left = this.sidesSpace
        }
      }
      return style
    }
  },
  methods: {
    // 更新视图
    updatePopper() {
      this.broadcast('ElSelectDropdown', 'updatePopper')
      this.broadcast('ElDropdownMenu', 'updatePopper')
    },
    // 动画结束执行已打开的事件
    afterEnter() {
      this.$emit('opened')
    },
    // 结束动画结束执行已关闭的事件
    afterLeave() {
      this.$emit('closed')
    },
    // 同步点击遮罩, 关闭弹框
    handleWrapperClick() {
      if (!this.closeOnClickModal) return
      this.handleClose()
    },
    // 关闭事件, 如果 cancel 返回为 false 则阻止关闭. 下同
    async handleClose() {
      if (this.isShowCancelButton) {
        let allowCloseDrawer = await this.cancel()
        if (allowCloseDrawer !== false) {
          this.$emit('update:visible', false)
          this.$emit('close')
          this.closed = true
        }
      } else {
        this.$emit('update:visible', false)
        this.$emit('close')
        this.closed = true
      }
    },
    async handleConfirm() {
      if (this.isShowConfirmButton) {
        let allowCloseDrawer = await this.confirm()
        if (allowCloseDrawer !== false) {
          this.$emit('update:visible', false)
          this.$emit('close')
          this.closed = true
        }
      } else {
        this.$emit('update:visible', false)
        this.$emit('close')
        this.closed = true
      }
    }
  },
  mounted() {
    // 默认是显示状态的话, 初始化组件
    if (this.visible) {
      this.rendered = true
      this.open()
      if (this.appendToBody) {
        document.body.appendChild(this.$el)
      }
    }
  },
  destroyed() {
    // if appendToBody is true, remove DOM node after destroy
    if (this.appendToBody && this.$el && this.$el.parentNode) {
      this.$el.parentNode.removeChild(this.$el)
    }
  }
}
</script>

<style>
  /* 侧边弹框显示详情页 */
  .ui-drawer__wrapper {
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
  }

  .ui-drawer__wrapper + .v-modal {
    position: absolute;
  }

  .ui-drawer {
    position: absolute;
    z-index: 101;
    top: 0;
    height: 100%;
    background-color: #fff;
  }

  .ui-drawer-right {
    right: 0;
  }

  .ui-drawer-left {
    left: 0;
  }

  .ui-drawer.active {
    -webkit-transition: transform .3s;
    transition: transform .3s;
    transform: translateX(0%);
  }

  .ui-drawer > .header {
    position: relative;
    height: 50px;
    line-height: 50px;
    font-size: 16px;
    padding: 0;
    text-align: center;
    border-bottom: 1px solid #e5e5e5;
  }

  .ui-drawer > .header .btn {
    position: absolute;
    top: 0;
    left: 0;
    margin: 10px;
  }

  .ui-drawer > .header .icon {
    font-size: 20px;
    line-height: 50px;
    position: absolute;
    top: 0;
    padding: 0 16px;
    cursor: pointer;
  }

  .ui-drawer-right > .header .icon {
    left: 0;
  }

  .ui-drawer-left > .header .icon {
    right: 0;
  }

  .ui-drawer > .header .icon:hover {
    background-color: #f4f4f4;
  }

  .ui-drawer > .content {
    position: absolute;
    top: 50px;
    right: 0;
    bottom: 0;
    left: 0;
    overflow: auto;
  }

  .ui-drawer > .footer {
    position: absolute;
    z-index: 2;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 9px 10px;
    text-align: right;
    border-top: 1px solid #e5e5e5;
  }

  .ui-drawer > .footer + .content {
    bottom: 50px;
  }

  .drawer-right-enter-active, .drawer-right-leave-active {
    transition: transform .2s;
    transform: translateX(0%);
  }

  .drawer-right-enter, .drawer-right-leave-to {
    transform: translateX(100%);
  }

  .drawer-left-enter-active, .drawer-left-leave-active {
    transition: transform .2s;
    transform: translateX(0%);
  }

  .drawer-left-enter, .drawer-left-leave-to {
    transform: translateX(-100%);
  }

  .drawer-fade-enter-active, .drawer-fade-leave-active {
    transition: opacity .2s;
    opacity: 1;
  }

  .drawer-fade-enter, .drawer-fade-leave-to {
    opacity: 0;
  }

</style>
