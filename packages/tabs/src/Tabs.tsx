import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import { assignInlineVars } from '@vanilla-extract/dynamic'

import { pipe } from './pipe'
import * as css from './Tabs.css'
import { makeState } from './Tabs.state'
import { makeTranslation } from './Tabs.translation'
import { ContextTabsController } from './useTabsController'

export interface ITab {
  /**
   * Unique key for each tab
   */
  key: string

  /**
   * Tab button label
   */
  buttonLabel: string

  /**
   * Component to render in a tab
   */
  component: React.ComponentType

  /**
   * Whether capture or bubble in touch event
   */
  useCapture?: boolean
}

interface ITabsProps {
  /**
   * Tabs
   */
  tabs: ITab[]

  /**
   * Active tab's key
   */
  activeTabKey: string

  /**
   * Called when tab changed
   */
  onTabChange: (key: string) => void

  /**
   * Class name appended to root div element
   */
  className?: string

  /**
   * Disable swipe
   */
  disableSwipe?: boolean

  /**
   * Whether use inline or fixed buttons in tabs
   */
  useInlineButtons?: true
}

const Tabs: React.FC<ITabsProps> = (props) => {
  const tabCount = props.tabs.length
  const activeTabIndex =
    props.tabs.findIndex((tab) => tab.key === props.activeTabKey) !== -1
      ? props.tabs.findIndex((tab) => tab.key === props.activeTabKey)
      : 0

  const containerRef = useRef<HTMLDivElement>(null)
  const tabMainsRef = useRef<HTMLDivElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabBarIndicatorRef = useRef<HTMLDivElement>(null)

  const mounted = useMounted()
  const [isSwipeDisabled, setIsSwipeDisabled] = useState(true)
  const [tabBarIndicatorTransform, setTabBarIndicatorTransform] =
    useState<string>('')

  const [lazyMap, setLazyMap] = useState<{
    [tabKey: string]: true | undefined
  }>({})

  useEffect(() => {
    setLazyMap((prevState) => ({
      ...prevState,
      [props.activeTabKey]: true,
    }))
  }, [props.activeTabKey])

  useEffect(() => {
    setIsSwipeDisabled(props.disableSwipe ?? false)
  }, [props.disableSwipe])

  const move = useCallback(
    (tab: ITab) => {
      props.onTabChange(tab.key)

      const MIN_SCROLL_MARGIN = 64
      const nextTabIndex = props.tabs.findIndex((t) => t === tab)

      const $tabBar = tabBarRef.current
      const $tabBarItem = $tabBar?.children[nextTabIndex + 1] as HTMLDivElement

      if (!$tabBar || !$tabBarItem) {
        return
      }

      const { clientWidth: fullWidth, scrollLeft } = $tabBar
      const { offsetLeft: itemLeft, clientWidth: itemWidth } = $tabBarItem

      const minScrollLeft = itemLeft + itemWidth + MIN_SCROLL_MARGIN - fullWidth
      const maxScrollLeft = itemLeft - MIN_SCROLL_MARGIN

      if (scrollLeft < minScrollLeft) {
        $tabBar.scroll({
          left: minScrollLeft,
          behavior: 'smooth',
        })
      }
      if (scrollLeft > maxScrollLeft) {
        $tabBar.scroll({
          left: maxScrollLeft,
          behavior: 'smooth',
        })
      }
    },
    [tabBarRef, activeTabIndex, props.onTabChange]
  )

  useEffect(() => {
    const $tabBar = tabBarRef.current
    const $tabBarIndicator = tabBarIndicatorRef.current
    const $tabMains = tabMainsRef.current

    if (!$tabBar || !$tabBarIndicator || !$tabMains) {
      return
    }

    const { dispatch, addEffect } = makeState({
      _t: 'idle',
      tabCount,
      activeTabIndex,
    })

    const { translate, resetTranslation } = makeTranslation({
      tabCount,
      activeTabIndex,
      $tabBar,
      $tabMains,
      $tabBarIndicator,
      useInlineButtons: Boolean(props.useInlineButtons),
    })

    const dispose = pipe(
      addEffect((state) => {
        if (state._t === 'swipe_started') {
          translate({
            dx: state.dx,
          })
          state.e.preventDefault()
        } else {
          resetTranslation()
        }
      }),
      addEffect((state) => {
        if (
          activeTabIndex !== state.activeTabIndex &&
          props.tabs[state.activeTabIndex]?.key
        ) {
          move(props.tabs[state.activeTabIndex])
        }
      })
    )

    const onTouchStart = (e: TouchEvent) => {
      if (isSwipeDisabled) {
        dispatch({
          _t: 'TOUCH_END',
        })
      } else {
        dispatch({
          _t: 'TOUCH_START',
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        })
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (isSwipeDisabled) {
        dispatch({
          _t: 'TOUCH_END',
        })
      } else {
        dispatch({
          _t: 'TOUCH_MOVE',
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          e,
        })
      }
    }

    const onTouchEnd = () => {
      dispatch({
        _t: 'TOUCH_END',
      })
    }

    const capture = props.tabs[activeTabIndex]?.useCapture ?? false

    $tabMains.addEventListener('touchstart', onTouchStart, {
      passive: true,
      capture,
    })
    $tabMains.addEventListener('touchmove', onTouchMove, {
      capture,
    })
    $tabMains.addEventListener('touchend', onTouchEnd, {
      passive: true,
      capture,
    })

    return () => {
      $tabMains.removeEventListener('touchstart', onTouchStart, capture)
      $tabMains.removeEventListener('touchmove', onTouchMove, capture)
      $tabMains.removeEventListener('touchend', onTouchEnd, capture)
      dispose()
    }
  }, [
    props,
    tabMainsRef,
    tabBarIndicatorRef,
    tabCount,
    activeTabIndex,
    isSwipeDisabled,
  ])

  useEffect(() => {
    const $tabBar = tabBarRef.current

    if (!$tabBar) {
      return
    }

    const setStyle = () => {
      if (props.useInlineButtons) {
        const $tabBarItem = $tabBar.children[
          activeTabIndex + 1
        ] as HTMLDivElement

        setTabBarIndicatorTransform(`
          translateX(${$tabBarItem.offsetLeft}px)
          scaleX(${$tabBarItem.clientWidth / $tabBar.clientWidth})
        `)
      } else {
        setTabBarIndicatorTransform(`translateX(${activeTabIndex * 100}%)`)
      }
    }

    setStyle()

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', setStyle)

      return () => {
        window.removeEventListener('resize', setStyle)
      }
    }
  }, [tabBarRef, activeTabIndex])

  const go = useCallback((tabKey: string) => {
    const activeTab = props.tabs.find((tab) => tab.key === tabKey)
    if (activeTab) {
      move(activeTab)
    }
  }, [])

  const enableSwipe = useCallback(() => {
    setIsSwipeDisabled(false)
  }, [])

  const disableSwipe = useCallback(() => {
    setIsSwipeDisabled(true)
  }, [])

  return (
    <ContextTabsController.Provider
      value={useMemo(
        () => ({
          go,
          enableSwipe,
          disableSwipe,
        }),
        [go, enableSwipe, disableSwipe]
      )}
    >
      <div
        ref={containerRef}
        className={[
          css.container,
          ...(props.className ? [props.className] : []),
        ].join(' ')}
        style={assignInlineVars({
          [css.vars.tabBar.indicator.display]: mounted ? 'block' : 'none',
          [css.vars.tabBar.indicator.width]: props.useInlineButtons
            ? '100%'
            : 100 / tabCount + '%',
          [css.vars.tabBar.indicator.transform]: tabBarIndicatorTransform,
          [css.vars.tabMain.width]: tabCount * 100 + '%',
          [css.vars.tabMain.transform]:
            'translateX(' + -1 * activeTabIndex * (100 / tabCount) + '%)',
        })}
      >
        <div
          ref={tabBarRef}
          className={css.tabBar({
            inline: props.useInlineButtons,
          })}
        >
          <div ref={tabBarIndicatorRef} className={css.tabBarIndicator} />
          {props.tabs.map((tab) => (
            <a
              key={tab.key}
              role="tab"
              aria-label={tab.buttonLabel}
              className={css.tabBarItem({
                active: props.activeTabKey === tab.key ? true : undefined,
                inline: props.useInlineButtons,
              })}
              onClick={() => move(tab)}
            >
              {tab.buttonLabel}
            </a>
          ))}
        </div>
        <div ref={tabMainsRef} className={css.tabMains}>
          {props.tabs.map(({ key, component: Component }) => (
            <div
              key={key}
              className={css.tabMain({
                active: props.activeTabKey === key ? true : undefined,
              })}
            >
              {lazyMap[key] && <Component />}
            </div>
          ))}
        </div>
      </div>
    </ContextTabsController.Provider>
  )
}

function useMounted() {
  const [mounted, mount] = useReducer(() => true, false)
  useEffect(() => mount(), [mount])

  return mounted
}

export default Tabs
