package com.healthplatform.app;

import android.app.Activity;
import android.graphics.Rect;
import android.view.View;
import android.view.ViewTreeObserver;
import android.widget.FrameLayout;

// AndroidBug5497Workaround — 전체화면/이머시브 상태에서 windowSoftInputMode=adjustResize 가
//   웹뷰 높이를 잘못 계산(키보드 열면 12px 로 붕괴)하는 안드로이드 버그(issue 5497) 우회.
//   키보드 표시/숨김 시 콘텐츠 뷰 높이를 "실제 보이는 영역(visible display frame)"으로 수동 보정.
//   참고: https://stackoverflow.com/a/19494006  (측정 결과 inner:12 붕괴 확인 → 적용, 2026-08-11)
public class AndroidBug5497Workaround {

    public static void assistActivity(Activity activity) {
        new AndroidBug5497Workaround(activity);
    }

    private final View mChildOfContent;
    private int usableHeightPrevious;
    private final FrameLayout.LayoutParams frameLayoutParams;

    private AndroidBug5497Workaround(Activity activity) {
        FrameLayout content = activity.findViewById(android.R.id.content);
        mChildOfContent = content.getChildAt(0);
        mChildOfContent.getViewTreeObserver().addOnGlobalLayoutListener(
            new ViewTreeObserver.OnGlobalLayoutListener() {
                public void onGlobalLayout() {
                    possiblyResizeChildOfContent();
                }
            });
        frameLayoutParams = (FrameLayout.LayoutParams) mChildOfContent.getLayoutParams();
    }

    private void possiblyResizeChildOfContent() {
        int usableHeightNow = computeUsableHeight();
        if (usableHeightNow != usableHeightPrevious) {
            int usableHeightSansKeyboard = mChildOfContent.getRootView().getHeight();
            int heightDifference = usableHeightSansKeyboard - usableHeightNow;
            if (heightDifference > (usableHeightSansKeyboard / 4)) {
                // 키보드 열림 — 키보드 높이만큼 뺀 높이로
                frameLayoutParams.height = usableHeightSansKeyboard - heightDifference;
            } else {
                // 키보드 닫힘 — 전체 높이로 복원
                frameLayoutParams.height = usableHeightSansKeyboard;
            }
            mChildOfContent.requestLayout();
            usableHeightPrevious = usableHeightNow;
        }
    }

    private int computeUsableHeight() {
        Rect r = new Rect();
        mChildOfContent.getWindowVisibleDisplayFrame(r);
        return (r.bottom - r.top);
    }
}
