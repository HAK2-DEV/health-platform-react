// 추천 퀴즈 라이브러리 — 운영자가 「퀴즈 만들기」 시 첫 화면(미션 라이브러리 패턴).
//
// 사용 흐름:
//   1. 대상자 선택 (예: 군인·20대 초반)
//   2. 주제별 예시 퀴즈(5문항) 목록 — 체크박스 + 펼쳐서 미리보기
//   3. 체크한 주제마다 별도 퀴즈로 발행 (시작/종료일은 운영자가 설정)
//
// 데이터 구조:
//   audiences[] → topics[] → questions[]
//   question 은 QuizCreatePage 의 내부 문항 형태와 맞춤:
//     type: 'MULTIPLE' | 'OX' | 'SHORT'
//     question_text, options[](MULTIPLE), correctIndex(MULTIPLE),
//     oxAnswer(OX), shortAnswer(SHORT, 다짐형은 null),
//     award_mode('CORRECT_ONLY' 기본), grading_mode('AUTO'/'MANUAL'),
//     point, explanation·source·sampleAnswer (라이브러리 표시·운영자 참고용)
//
// ⚠️ 콘텐츠 출처는 본인이 2026-06-04 공공기관·학술지로 검증함.
//   해설·출처는 라이브러리(운영자)에서만 노출. 발행된 quiz_questions 에는 저장 안 함.
// ⚠️ 객관식 정답이 원본에선 전부 보기1 → 발행 시 보기 순서 셔플로 정답 위치 랜덤화.

const A = 'CORRECT_ONLY' // award_mode 기본(맞추면 지급)

// 객관식
const mc = (question_text, options, correctIndex, explanation, source = null, point = 10) => ({
  type: 'MULTIPLE', question_text, options, correctIndex,
  award_mode: A, grading_mode: 'AUTO', point, explanation, source,
})
// OX
const ox = (question_text, oxAnswer, explanation, source = null, point = 10) => ({
  type: 'OX', question_text, oxAnswer,
  award_mode: A, grading_mode: 'AUTO', point, explanation, source,
})
// 주관식(다짐·성찰형 — 정답 없음, 기본 운영자 수동채점 / 맞추면 지급)
const sa = (question_text, sampleAnswer, explanation, source = null, point = 10) => ({
  type: 'SHORT', question_text, shortAnswer: null,
  award_mode: A, grading_mode: 'MANUAL', point, explanation, source, sampleAnswer,
})

const TOPICS = [
  {
    key: 'smoking', title: '금연', emoji: '🚭', category: 'NO_SMOKING',
    questions: [
      mc('흡연이 군 체력평가와 관련해 나타낼 수 있는 영향으로 가장 적절한 것은?',
        ['3km 달리기 기록이 느려지고 팔굽혀펴기·윗몸일으키기 수행이 낮아질 수 있다', '심폐지구력과 전혀 관련이 없다', '단기간 흡연은 폐기능을 높인다', '흡연자는 운동 회복이 항상 더 빠르다'], 0,
        '군인 대상 연구에서 흡연자는 달리기 기록과 근력·근지구력 평가에서 불리한 경향이 보고되었습니다.',
        'https://doi.org/10.1155/2020/5968189'),
      ox('흡연은 피부 광노화를 촉진할 수 있으므로 피부 건강을 위해서도 금연이 중요하다.', 'O',
        '흡연은 피부 노화와 관련된 위험요인으로 설명됩니다.',
        'https://www.k-health.com/news/articleView.html?idxno=70596'),
      ox('궐련형 전자담배는 일반담배보다 유해물질이 없어 건강에 안전하다고 볼 수 있다.', 'X',
        '궐련형 전자담배도 유해성분과 발암물질이 보고되어 안전하다고 단정할 수 없습니다.',
        'https://www.khan.co.kr/article/201806072229005'),
      mc('금연 후 비교적 빠르게 나타나는 신체 변화로 가장 적절한 것은?',
        ['20분 후 혈압과 맥박이 정상화되는 방향으로 변한다', '폐기능은 10년이 지나야 처음 변한다', '금연 직후 산소 운반 능력은 반드시 악화된다', '금연 후 체력 회복은 불가능하다'], 0,
        '금연은 시간 경과에 따라 심혈관·호흡기 지표 회복에 도움이 됩니다.',
        'https://clinic.paju.go.kr/clinic/clinic_03/clinic_03_01/clinic_03_01_10.jsp'),
      sa('스트레스 때문에 흡연하고 싶을 때 사용할 수 있는 대체 행동을 2가지 적으세요.',
        '예: 심호흡, 짧은 산책, 물 마시기, 동료와 대화, 운동, 상담 요청',
        '군 장병 흡연 이유 중 스트레스 해소가 큰 비중을 차지하므로, 스트레스 대처 행동을 미리 정하는 것이 중요합니다.',
        'https://biz.heraldcorp.com/article/1916885'),
    ],
  },
  {
    key: 'alcohol', title: '절주', emoji: '🍺', category: 'ETC',
    questions: [
      mc('운동 후 음주가 근성장에 불리한 이유로 가장 적절한 것은?',
        ['단백질 합성을 낮추어 회복과 근성장을 방해할 수 있다', '근육 단백질 합성을 크게 증가시킨다', '수분 보충 효과가 커서 회복이 빨라진다', '비타민과 미네랄 손실을 막아준다'], 0,
        '음주 후 단백질 합성이 저하되어 운동 회복과 근성장에 불리할 수 있습니다.',
        'http://www.samsunghospital.com/home/healthInfo/content/contenView.do?CONT_CLS_CD=001021005003&CONT_ID=6352&CONT_SRC=HOMEPAGE&CONT_SRC_ID=33770'),
      ox('고농도 음주는 탈수와 호르몬 변화 등을 통해 근육 생성에 방해가 될 수 있다.', 'O',
        '알코올은 탈수와 테스토스테론 저하 등 운동 회복에 불리한 요인과 관련됩니다.',
        'http://www.samsunghospital.com/home/healthInfo/content/contenView.do?CONT_CLS_CD=001021005003&CONT_ID=6352&CONT_SRC=HOMEPAGE&CONT_SRC_ID=33770'),
      ox('건강을 위해 누구에게나 안전하다고 보장되는 음주량이 명확히 정해져 있다.', 'X',
        'WHO와 질병관리청 자료는 음주에 대해 \'안전한 음주량\'으로 단정하기 어렵다는 관점을 제시합니다.',
        'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5297'),
      mc('알코올 1g당 열량으로 가장 적절한 것은?',
        ['약 7kcal', '약 1kcal', '약 3kcal', '약 12kcal'], 0,
        '알코올은 1g당 약 7kcal로 열량이 높고 영양소 대사를 방해할 수 있습니다.',
        'http://www.samsunghospital.com/home/healthInfo/content/contenView.do?CONT_CLS_CD=001021005003&CONT_ID=6352&CONT_SRC=HOMEPAGE&CONT_SRC_ID=33770'),
      sa('운동 목표가 있을 때 술자리에서 실천할 수 있는 절주 행동을 2가지 적으세요.',
        '예: 마실 양을 미리 정하기, 무알코올 음료 선택, 운동 전후 음주 피하기, 물을 함께 마시기, 권유 거절 문장 준비',
        '절주는 운동 회복, 체중관리, 암 예방 측면에서 모두 의미가 있습니다.',
        'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5297'),
    ],
  },
  {
    key: 'nutrition', title: '영양', emoji: '🥗', category: 'DIET',
    questions: [
      mc('근육합성을 고려한 단백질 섭취 방법으로 가장 적절한 것은?',
        ['하루 단백질을 끼니별로 나누어 섭취한다', '하루 단백질을 한 번에 몰아서 먹는다', '보충제만 먹고 일반식은 줄인다', '운동하지 않는 날에는 단백질이 전혀 필요 없다'], 0,
        '한 번에 활용 가능한 단백질 양에는 한계가 있어 끼니별 분할 섭취가 유리합니다.',
        'https://www.k-health.com/news/articleView.html?idxno=88625'),
      ox('고단백 식단을 장기간 과도하게 유지하면 신장에 부담이 될 수 있다.', 'O',
        '특히 기존 신장질환 위험이 있거나 과도한 단백질 섭취를 장기간 지속하면 주의가 필요합니다.',
        'https://www.k-health.com/news/articleView.html?idxno=88625'),
      ox('운동 효과를 높이려면 운동량뿐 아니라 식단의 질도 중요하다.', 'O',
        '초가공식품 위주 식사는 여러 건강위험과 관련되어 있어 식단 질 관리가 필요합니다.',
        'https://bmjgroup.com/consistent-evidence-links-ultra-processed-food-to-over-30-damaging-health-outcomes/'),
      mc('초가공식품을 많이 섭취하는 식습관과 관련성이 높은 건강위험으로 가장 적절한 것은?',
        ['심혈관질환·제2형당뇨·비만 위험 증가', '모든 질병 위험의 확실한 감소', '수면시간의 무조건 증가', '근력의 즉각적인 증가'], 0,
        '대규모 리뷰에서 초가공식품 섭취는 여러 불리한 건강결과와 관련되었습니다.',
        'https://bmjgroup.com/consistent-evidence-links-ultra-processed-food-to-over-30-damaging-health-outcomes/'),
      sa('PX나 편의점에서 초가공 간식을 줄이기 위해 선택할 수 있는 대체 식품을 2가지 적으세요.',
        '예: 삶은 달걀, 무가당 요거트, 견과류, 과일, 우유, 두유, 샐러드, 닭가슴살',
        '가공도가 낮고 단백질·식이섬유가 있는 식품으로 대체하면 식단 질 개선에 도움이 됩니다.',
        'https://bmjgroup.com/consistent-evidence-links-ultra-processed-food-to-over-30-damaging-health-outcomes/'),
    ],
  },
  {
    key: 'activity', title: '신체활동', emoji: '🏃', category: 'WALKING',
    questions: [
      mc('우울·불안 완화에 도움이 되는 운동으로 근거가 비교적 강하게 제시된 것은?',
        ['유산소 운동', '밤샘 게임', '장시간 앉아 있기', '운동을 완전히 피하기'], 0,
        '운동은 우울·불안 증상 완화에 도움이 될 수 있지만, 연구 한계도 함께 고려해야 합니다.',
        'https://bmjgroup.com/aerobic-exercise-may-be-most-effective-for-relieving-depression-anxiety-symptoms/'),
      ox('근육통이 오래 지속될수록 근성장이 더 잘 된다는 뜻이다.', 'X',
        '근육통은 회복 과정의 신호일 수 있지만 근성장의 크기를 그대로 의미하지는 않습니다.',
        'https://www.stcarollo.or.kr/0401/5588'),
      ox('운동 후 48시간 정도 회복했는데도 일주일 내내 운동을 쉬어야만 효과가 있다.', 'X',
        '회복 상태에 따라 조절해야 하며, 무조건 장기간 쉬는 것이 효율적이라고 볼 수는 없습니다.',
        'https://www.stcarollo.or.kr/0401/5588'),
      mc('성인 신체활동 권장량으로 가장 적절한 것은?',
        ['주당 중강도 150분 또는 고강도 75분 + 근력운동 주 2회 이상', '월 1회 10분 걷기', '근력운동만 매일 3시간', '숨이 찰 정도의 운동은 모두 금지'], 0,
        '성인은 유산소 활동과 근력운동을 함께 실천하는 것이 권장됩니다.',
        'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5293'),
      sa('스트레스가 높을 때 바로 실천할 수 있는 신체활동 한 가지를 적으세요.',
        '예: 10분 걷기, 계단 오르기, 가벼운 조깅, 스트레칭, 팔굽혀펴기, 스쿼트',
        '짧은 활동도 기분 전환과 스트레스 완화에 도움이 될 수 있습니다.',
        'https://bmjgroup.com/aerobic-exercise-may-be-most-effective-for-relieving-depression-anxiety-symptoms/'),
    ],
  },
  {
    key: 'oral', title: '구강건강', emoji: '🦷', category: 'ETC',
    questions: [
      ox('흡연·커피로 생긴 치아 착색은 양치만으로 항상 원래 색으로 완전히 돌아온다.', 'X',
        '착색·변색은 양치만으로 해결되지 않을 수 있으며 전문 관리가 필요할 수 있습니다.',
        'https://www.k-health.com/news/articleView.html?idxno=22209'),
      ox('흡연과 혀 백태는 구취와 관련될 수 있어 혀 닦기와 치실 사용도 중요하다.', 'O',
        '구취 관리는 칫솔질뿐 아니라 혀 관리, 치실 사용, 금연 등과 연결됩니다.',
        'https://www.k-health.com/news/articleView.html?idxno=22209'),
      ox('치주질환은 입 안 문제일 뿐 전신 건강과는 관련이 없다.', 'X',
        '치주질환은 심혈관질환·당뇨 등 전신 건강과의 관련성이 보고됩니다.',
        'https://www.kperio.org/patient/General.php'),
      mc('최근 외래 다빈도 상병에서 매우 높은 비중을 차지한 구강질환은?',
        ['치은염 및 치주질환', '손목 골절', '급성 맹장염', '색맹'], 0,
        '치은염·치주질환은 외래 진료에서 매우 흔한 질환입니다.',
        'https://www.seoul.co.kr/news/society/health-medical/2025/06/08/20250608500067'),
      sa('치주질환 예방을 위해 실천할 수 있는 행동을 2가지 적으세요.',
        '예: 올바른 칫솔질, 치실 사용, 혀 닦기, 정기 스케일링, 금연',
        '정기적인 구강관리와 스케일링은 치주질환 예방과 재발 방지에 중요합니다.',
        'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5718'),
    ],
  },
  {
    key: 'suicide', title: '자살예방', emoji: '💛', category: 'MINDCARE',
    questions: [
      ox('주변 사람이 힘들어 보일 때 위험신호를 보고, 이야기를 듣고, 필요한 도움으로 연결하는 것이 중요하다.', 'O',
        '게이트키퍼의 핵심은 위험신호 파악, 경청, 전문자원 연결입니다.',
        'https://edu.kfsp.or.kr/edu/common/greeting.do'),
      ox('자살 생각이 있는지 직접 물어보면 위험이 커지므로 절대 물어보면 안 된다.', 'X',
        '적절하게 직접 묻고 경청하는 것은 위험을 파악하고 도움을 연결하는 데 중요합니다.',
        'https://edu.kfsp.or.kr/edu/common/greeting.do'),
      mc('자살예방 상담전화 번호로 가장 적절한 것은?',
        ['109', '119', '1336', '120'], 0,
        '109는 자살예방 상담전화로 24시간 운영됩니다.',
        'https://www.129.go.kr/109'),
      mc('자살예방 게이트키퍼 교육의 핵심 흐름으로 가장 적절한 것은?',
        ['보고-듣고-말하기', '비난-설득-격리하기', '무시-회피-기다리기', '충고-판단-종결하기'], 0,
        '위험신호를 보고, 이야기를 듣고, 전문가나 도움 자원에 연결하는 흐름입니다.',
        'https://edu.kfsp.or.kr/edu/common/greeting.do'),
      sa('힘들 때 도움을 요청할 수 있는 사람이나 기관을 2가지 적으세요.',
        '예: 전우, 가족, 간부, 병영생활 전문상담관, 군종, 상담전화 109',
        '위기 상황 전에 도움 자원을 미리 정해두면 실제 도움 요청이 쉬워집니다.',
        'https://www.129.go.kr/109'),
    ],
  },
  {
    key: 'dementia', title: '치매', emoji: '🧠', category: 'ETC',
    questions: [
      ox('치매 예방은 노년기에만 의미가 있고, 젊을 때의 생활습관과는 관련이 없다.', 'X',
        '중년기 이전부터 운동, 금연, 절주, 사회활동 등 보호요인을 강화하는 것이 중요합니다.',
        'https://www.alzint.org/news-events/news/lancet-commission-identifies-two-new-risk-factors-for-dementia-and-suggests-45-of-cases-could-be-delayed-or-reduced/'),
      mc('치매 예방을 위한 운동 습관으로 가장 적절한 것은?',
        ['주 5회 중강도 30분 또는 주 3회 고강도 20분 운동', '1년에 한 번만 운동하기', '운동은 뇌 건강과 무관하므로 하지 않기', '운동 대신 음주량 늘리기'], 0,
        '규칙적 운동은 뇌혈류 개선과 뇌 건강 유지에 도움이 될 수 있습니다.',
        'https://www.nhis.or.kr/static/alim/paper/oldpaper/202309/sub/section1_4.html'),
      ox('흡연과 과음은 인지장애·치매 위험과 관련될 수 있다.', 'O',
        '흡연과 과음은 인지기능 저하 위험요인으로 제시됩니다.',
        'https://www.nhis.or.kr/static/alim/paper/oldpaper/202309/sub/section1_4.html'),
      mc('Lancet Commission 2024에서 제시한 \'바꿀 수 있는 치매 위험요인\'의 수로 가장 적절한 것은?',
        ['14개', '2개', '100개', '0개'], 0,
        '교육, 운동, 흡연, 음주, 고혈압, 비만 등 14개 위험요인이 제시되었습니다.',
        'https://www.alzint.org/news-events/news/lancet-commission-identifies-two-new-risk-factors-for-dementia-and-suggests-45-of-cases-could-be-delayed-or-reduced/'),
      sa('치매 예방을 위해 생활 속에서 실천할 수 있는 행동을 3가지 적으세요.',
        '예: 규칙적 운동, 금연, 절주, 사회활동, 배움 지속, 혈압 관리',
        '치매 예방은 위험요인을 줄이고 보호요인을 강화하는 방향으로 접근합니다.',
        'https://www.alzint.org/news-events/news/lancet-commission-identifies-two-new-risk-factors-for-dementia-and-suggests-45-of-cases-could-be-delayed-or-reduced/'),
    ],
  },
  {
    key: 'addiction', title: '중독', emoji: '🎰', category: 'MINDCARE',
    questions: [
      mc('최근 군 내에서 휴대전화 사용과 함께 증가가 지적된 문제로 가장 적절한 것은?',
        ['사이버도박', '손씻기', '치실 사용', '독서량 증가'], 0,
        '군 내 사이버도박 관련 형사입건 증가가 보도되었습니다.',
        'https://www.seoul.co.kr/news/politics/2024/09/30/20240930500208'),
      ox('불법도박은 단순 장난이므로 형사처벌이나 군 징계와는 관련이 없다.', 'X',
        '불법도박은 법적 처벌과 징계로 이어질 수 있습니다.',
        'https://www.lawissue.co.kr/view.php?ud=202410021204541666cf2d78c68_12'),
      ox('온라인 환경은 도박이나 마약류 접근성을 높일 수 있어 주의가 필요하다.', 'O',
        '스마트폰·온라인 접근성 증가는 중독 문제의 위험요인으로 지적됩니다.',
        'https://www.seoul.co.kr/news/politics/2024/09/30/20240930500208'),
      mc('도박문제 전문 도움을 받을 수 있는 헬프라인 번호로 가장 적절한 것은?',
        ['1336', '112', '129', '182'], 0,
        '1336은 도박문제 예방·치유 지원과 연계되는 상담 자원입니다.',
        'https://www.gov.kr/portal/service/serviceInfo/137100000173'),
      sa('도박 충동이 생겼을 때 취할 수 있는 안전한 행동을 2가지 적으세요.',
        '예: 도박 사이트 차단, 결제수단 차단, 상담 요청, 신뢰하는 사람에게 알리기, 1336 연락',
        '중독은 혼자 끊기 어려울 수 있어 조기 도움 요청이 중요합니다.',
        'https://www.gov.kr/portal/service/serviceInfo/137100000173'),
    ],
  },
  {
    key: 'community_mental', title: '지역사회정신건강', emoji: '🧘', category: 'MINDCARE',
    questions: [
      ox('전국민 마음투자 지원사업은 정서적 어려움이 있는 국민에게 전문 심리상담 바우처를 지원한다.', 'O',
        '전문 심리상담 바우처를 통해 조기 개입을 지원하는 제도입니다.',
        'https://www.socialservice.or.kr:444/user/htmlEditor/view2.do?p_sn=71'),
      ox('일부 청년 마음건강 지원사업은 의무복무 제대군인에게 군 복무기간에 따른 연령 연장을 적용할 수 있다.', 'O',
        '서울시 공고 기준에서 의무복무 제대군인의 연령 연장 내용이 확인됩니다.',
        'https://news.seoul.go.kr/gov/archives/576372'),
      mc('마음이 힘들 때 도움 요청 대상으로 가장 적절한 것은?',
        ['병영생활 전문상담관·군종·상담전화 등', '아무에게도 말하지 않고 버티기', '문제를 모두 장난으로 넘기기', '수면을 줄이고 혼자 해결하기'], 0,
        '정신건강 문제는 혼자 참기보다 이용 가능한 자원을 연결하는 것이 중요합니다.',
        'https://www.129.go.kr/109'),
      ox('국가건강검진 정신건강검사 결과에 따라 심리상담 연계가 이루어질 수 있다.', 'O',
        'PHQ-9 등 정신건강검사 결과는 조기 발견과 상담 연계에 활용될 수 있습니다.',
        'https://www.socialservice.or.kr:444/user/htmlEditor/view2.do?p_sn=71'),
      sa('내가 실제로 도움을 요청할 수 있는 사람이나 기관을 2가지 적으세요.',
        '예: 가족, 친구, 전우, 간부, 상담관, 군종, 지역 정신건강복지센터, 상담전화',
        '도움 요청 대상을 구체적으로 적어두면 위기 때 접근 장벽이 낮아집니다.',
        'https://www.129.go.kr/109'),
    ],
  },
  {
    key: 'cancer', title: '암', emoji: '🎗️', category: 'ETC',
    questions: [
      ox('50세 미만 조기발병암은 1990년부터 2019년 사이 전 세계적으로 증가한 것으로 보고되었다.', 'O',
        'BMJ Oncology 분석에서 50세 미만 조기발병암 증가가 보고되었습니다.',
        'https://bmjgroup.com/global-surge-in-cancers-among-the-under-50s-over-past-three-decades/'),
      mc('조기발병암 위험요인으로 함께 언급되는 생활습관 조합으로 가장 적절한 것은?',
        ['식이, 음주, 흡연', '손톱 길이, 머리색, 혈액형', '하루 물컵 색깔, 신발 크기', '휴대폰 배경화면'], 0,
        '식이, 음주, 흡연은 바꿀 수 있는 암 위험요인으로 자주 언급됩니다.',
        'https://bmjgroup.com/global-surge-in-cancers-among-the-under-50s-over-past-three-decades/'),
      ox('알코올은 1군 발암물질로 분류되며 여러 암 위험과 관련될 수 있다.', 'O',
        '알코올 대사산물인 아세트알데히드는 구강, 식도, 대장, 유방 등 여러 암 위험과 관련됩니다.',
        'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5297'),
      mc('한국 20·30대 연구에서 지방간과 관련해 보고된 내용으로 가장 적절한 것은?',
        ['50세 미만 조기 암 위험 증가와 관련될 수 있다', '암 위험을 반드시 0으로 낮춘다', '생활습관과 무관하다', '젊은 층에서는 의미가 없다'], 0,
        '젊은 지방간 환자에서 50세 미만 조기 암 위험 증가가 보고되었습니다.',
        'https://biz.heraldcorp.com/article/10581509'),
      sa('암 예방을 위해 바꿀 수 있는 생활습관을 2가지 적으세요.',
        '예: 금연, 절주, 규칙적 운동, 체중관리, 균형 잡힌 식사',
        '암 예방은 바꿀 수 있는 위험요인을 줄이는 것에서 시작합니다.',
        'https://bmjgroup.com/global-surge-in-cancers-among-the-under-50s-over-past-three-decades/'),
    ],
  },
  {
    key: 'cardio', title: '심뇌혈관', emoji: '❤️', category: 'ETC',
    questions: [
      ox('20·30대도 고혈압 관리가 필요하며 생활습관의 영향을 받을 수 있다.', 'O',
        '청년층 고혈압도 증가 추세가 보고되며, 생활습관 관리가 중요합니다.',
        'https://edaily.co.kr/News/Read?mediaCodeNo=257&newsId=02584646645449576'),
      mc('고혈압이 \'침묵의 살인자\'라고 불리는 이유로 가장 적절한 것은?',
        ['대부분 뚜렷한 증상이 없어 측정 전까지 모를 수 있기 때문이다', '항상 심한 통증이 먼저 오기 때문이다', '젊은 사람에게는 절대 생기지 않기 때문이다', '운동하면 반드시 악화되기 때문이다'], 0,
        '고혈압은 무증상인 경우가 많아 정기 측정이 핵심입니다.',
        'https://www.rapportian.com/news/articleView.html?idxno=221168'),
      ox('짠 음식, 가공식품, 음주는 젊은 고혈압과 관련된 생활요인으로 볼 수 있다.', 'O',
        '나트륨 과다와 음주는 혈압 상승과 관련됩니다.',
        'https://edaily.co.kr/News/Read?mediaCodeNo=257&newsId=02584646645449576'),
      mc('20·30대 고혈압 관리의 문제점으로 가장 적절한 것은?',
        ['인지율·치료율·조절률이 낮아 관리 사각지대가 될 수 있다', '인지율이 100%라 문제가 없다', '치료가 필요 없는 연령대다', '혈압 측정이 전혀 불가능하다'], 0,
        '젊은 층은 고혈압을 알고 치료·조절하는 비율이 낮아 관리가 늦어질 수 있습니다.',
        'https://www.dailymedi.com/news/news_view.php?wr_id=918335'),
      sa('혈압 관리를 위해 실천할 수 있는 생활습관을 2가지 적으세요.',
        '예: 정기 혈압 측정, 나트륨 줄이기, 규칙적 운동, 절주, 체중관리, 금연',
        '젊을 때부터 혈압을 관리하면 장기적인 혈관 손상 누적을 줄이는 데 도움이 됩니다.',
        'https://www.rapportian.com/news/articleView.html?idxno=221168'),
    ],
  },
  {
    key: 'obesity', title: '비만', emoji: '⚖️', category: 'ETC',
    questions: [
      mc('급격한 감량이 요요로 이어질 수 있는 이유로 가장 적절한 것은?',
        ['지방과 근육이 함께 줄고 기초대사량이 낮아질 수 있기 때문이다', '근육량이 반드시 크게 증가하기 때문이다', '식욕이 영구적으로 사라지기 때문이다', '감량 후에는 에너지 섭취와 무관해지기 때문이다'], 0,
        '무리한 감량은 근육 손실과 기초대사량 저하를 유발해 체중 재증가 위험을 높일 수 있습니다.',
        'https://www.nhis.or.kr/magazin/146/html/sub2.html'),
      ox('무리한 단기 다이어트는 영양결핍, 부정맥, 면역저하 등 건강문제를 일으킬 수 있다.', 'O',
        '극단적 감량은 신체 기능 저하와 여러 건강문제를 유발할 수 있습니다.',
        'https://www.nhis.or.kr/magazin/146/html/sub2.html'),
      ox('체중 감량 후 다시 늘었다고 해서 무조건 포기해야 하며, 다시 관리해도 의미가 없다.', 'X',
        '요요 관련 근거에는 논쟁이 있지만, 감량을 포기하기보다 지속 가능한 관리로 재시도하는 것이 중요합니다.',
        'https://news.sbs.co.kr/news/endPage.do?news_id=N1007878152'),
      mc('같은 체중이라도 복부비만이 특히 중요한 이유로 가장 적절한 것은?',
        ['고혈압·당뇨·심뇌혈관질환 위험과 연결될 수 있기 때문이다', '키가 반드시 커지기 때문이다', '수면 시간이 항상 늘어나기 때문이다', '운동 능력을 무조건 높이기 때문이다'], 0,
        '내장지방형 비만은 대사질환과 심뇌혈관질환 위험과 관련됩니다.',
        'https://www.kmib.co.kr/article/view.asp?arcid=0029836998'),
      sa('건강한 체중관리를 위한 원칙을 2가지 적으세요.',
        '예: 서서히 감량하기, 굶지 않고 규칙적으로 먹기, 근력운동 병행, 단백질 섭취, 수면관리',
        '체중관리는 빠른 감량보다 지속 가능성과 근육 유지가 중요합니다.',
        'https://www.nhis.or.kr/magazin/146/html/sub2.html'),
    ],
  },
]

// ─── 근로자(직장인) 대상 ───────────────────────────────────
//   문항별 출처(공공기관·검증 완료). 각 URL은 실제 접속+주제 일치를 확인함(2026-06).
//   ※ 자동 점검 도구에서만 막히는 사이트(브라우저는 정상) — 배포 전 1회 확인 권장:
//     - kcgp.or.kr(1336 상담안내): SSL 중간인증서 체인 이슈
//     - samsunghospital.com(절주 Q1): https→http 다운그레이드라 http 링크 유지
//   ※ 신체활동 '앉아있기=흡연' 캐치프레이즈, 눈 '20-20-20'은 한국 공공 출처에 원문이 없어
//     주제 근거 페이지로만 연결(해설에서 공식 인용처럼 쓰지 말 것).
const SRC = {
  // 금연
  smokeCessation: 'https://www.cancer.go.kr/lay1/S1T199C204/sublink.do',          // 흡연과 금연(국가암정보센터)
  ecigKhan: 'https://www.khan.co.kr/article/201806072229005',                     // 궐련형 타르(경향, 식약처 2018 인용)
  smokeStat: 'https://www.cancer.go.kr/lay1/S1T204C225/contents.do',              // 흡연 통계(남성 34.0%)
  noSmokeGuide: 'https://www.nosmokeguide.go.kr/',                                // 금연길라잡이(국가금연지원센터)
  // 절주
  alcoholKcal: 'http://www.samsunghospital.com/home/healthInfo/content/contenView.do?CONT_CLS_CD=001021005003&CONT_ID=6352&CONT_SRC=HOMEPAGE&CONT_SRC_ID=33770', // 술과 운동
  kdcaDrink: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5297', // 음주(국가건강정보포털)
  drinkPractice: 'https://www.cancer.go.kr/lay1/S1T231C234/contents.do',          // 절주 계획과 실천
  // 영양
  kdcaCarb: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=1342',  // 탄수화물 섭취
  kdcaSodium: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5335', // 염분 섭취
  mfdsCaffeine: 'https://impfood.mfds.go.kr/CFBBB02F02/getCntntsDetail?cntntsSn=281601', // 카페인 안전 수준(식약처)
  kdcaNutrition: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6693', // 식이영양 허브
  // 신체활동
  kdcaPhysical: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6251', // 신체활동(좌식·습관)
  kdcaExercise: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5293', // 운동(10분3번·주150분)
  // 근골격·눈
  kdcaTurtle: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5972', // 일자목(거북목)증후군
  vdtGuideLaw: 'https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000027843',  // VDT 작업관리지침(고용노동부 고시)
  kdcaDryEye: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6306', // 안구건조증(눈 휴식)
  // 수면
  nhisMelatonin: 'https://www.nhis.or.kr/magazin/144/html/c06.html',              // 스마트폰·멜라토닌(건강iN)
  nhisSleepLack: 'https://www.nhis.or.kr/magazin/160/html/sub2.html',             // 수면 부족이 질병을 부른다
  nhisSleepHygiene: 'https://www.nhis.or.kr/magazin/137/html/c03.html',           // 꿀잠 자는 법(수면위생)
  // 직무스트레스
  nhisBurnout: 'https://www.nhis.or.kr/magazin/150/html/sub3.html',               // 번아웃 증후군(건강iN)
  eapLaw: 'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1407&ccfNo=5&cciNo=1&cnpClsNo=2', // EAP(근로복지기본법 제83조)
  counsel109: 'https://www.129.go.kr/109',                                        // 자살예방상담 109
  // 구강
  hiraStat: 'https://opendata.hira.or.kr/op/opc/olapHifrqSickInfoTab1.do',        // 다빈도질병 통계(심평원)
  kdcaPerio: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5718', // 전신질환과 치주치료
  toothStain: 'https://www.k-health.com/news/articleView.html?idxno=45518',       // 치아착색 원인(헬스경향, 치과 자문)
  kdcaOralCare: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6291', // 구강병 예방·관리
  // 중독·디지털
  gambleLaw: 'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=901&ccfNo=3&cciNo=1&cnpClsNo=1', // 불법도박 처벌(생활법령)
  smartRest: 'https://www.iapc.or.kr/',                                           // 스마트쉼센터(과의존 예방)
  mentalSleep: 'https://www.mentalhealth.go.kr/portal/disease/diseaseDetail.do?dissId=32', // 수면과 수면장애(정신건강포털)
  gambleHelp1336: 'https://www.kcgp.or.kr/portal/main/contents.do?menuNo=200062', // 헬프라인 1336 상담안내
  // 심뇌혈관
  bpSixRules: 'https://www.kpanews.co.kr/news/articleView.html?idxno=534930',     // 고혈압 6대수칙(질병관리청 인용)
  redCircle: 'https://www.korea.kr/news/policyNewsView.do?newsId=148892985',      // 레드서클 심뇌혈관 예방
  cvdNineRules: 'https://www.korea.kr/news/policyNewsView.do?newsId=148892499',   // 심뇌혈관 9대 생활수칙
  // 암
  cancerScreening: 'https://www.cancer.go.kr/lay1/S1T198C261/sublink.do',         // 국가암검진 사업
  cancerTarget: 'https://www.cancer.go.kr/lay1/S1T549C553/sublink.do',            // 검진 대상자 선정·통보
  cancerPrevent: 'https://www.cancer.go.kr/lay1/S1T200C203/contents.do',          // 국민 암예방 수칙
  // 비만
  kdcaObesity: 'https://health.kdca.go.kr/healthinfo/biz/health/ntcnInfo/healthSourc/thtimtCntnts/thtimtCntntsView.do?thtimt_cntnts_sn=39', // 비만 관리(허리둘레)
  nhisDietHarm: 'https://www.nhis.or.kr/magazin/146/html/sub2.html',              // 무리한 다이어트(요요)
  nhisDietHealthy: 'https://www.nhis.or.kr/static/alim/paper/oldpaper/202407/sub/section1_2.html', // 건강한 다이어트(체성분·실천)
}

const WORKER_TOPICS = [
  {
    key: 'smoking', title: '금연', emoji: '🚭', category: 'NO_SMOKING',
    questions: [
      mc('하루 한 갑(4,500원)을 피우는 직장인이 10년간 담배에 쓰는 돈은 대략 얼마일까?',
        ['약 160만 원', '약 600만 원', '약 1,600만 원', '약 5,000만 원'], 2,
        '하루 4,500원이면 1년 약 164만 원, 10년이면 1,600만 원이 넘습니다. 중형차 한 대 값이 재가 되어 사라지는 셈입니다. "건강에 나쁘다"는 막연한 말보다, 통장에서 빠져나가는 돈이 더 크게 와닿습니다.', SRC.smokeCessation),
      ox('담배를 끊으면 단 2주~3개월 안에 폐 기능과 혈액순환이 좋아지기 시작해, 계단 오를 때 숨이 덜 차는 변화를 직접 느낄 수 있다.', 'O',
        '금연 효과는 20년 뒤가 아니라 며칠~몇 주 안에 시작됩니다. 20분 후 혈압·맥박이 안정되고, 2~3주면 혈액순환과 폐 기능이 나아져 일상에서 "덜 헐떡인다"는 걸 체감합니다.', SRC.smokeCessation),
      ox('전자담배·궐련형 담배(아이코스 등)는 "덜 해롭다"고 알려졌지만, 식약처 분석에서 타르가 일반담배만큼(혹은 그 이상) 검출됐다.', 'O',
        '식약처 분석에서 궐련형 전자담배의 타르는 일반담배와 비슷하거나 더 높게 나왔고, 1급 발암물질도 검출됐습니다. "제품만 바꾸면 괜찮다"는 생각은 흡연을 이어가는 통로가 되기 쉽습니다.', SRC.ecigKhan),
      mc('"남자 직장인은 대부분 담배를 피운다"는 흔한 생각, 실제 우리나라 성인 남성 흡연율에 가장 가까운 것은?',
        ['약 70%', '약 50%', '약 30%대', '약 90%'], 2,
        '성인 남성 흡연율은 30%대까지 낮아져, 안 피우는 사람이 다수입니다. "다들 피우니까" 눈치를 보지만 실제로는 끊는 쪽이 대세입니다.', SRC.smokeStat),
      sa('담배를 끊어 10년간 모은 1,600만 원이 통장에 있다고 상상해보세요. 그 돈으로 가장 하고 싶은 것 1가지와, 흡연 욕구가 올라오는 "내 상황"에서 담배 대신 할 행동 1가지를 적어보세요.',
        '예: 여행·전세자금 / 점심 후엔 양치하고 5분 걷기, 스트레스엔 커피 대신 물·심호흡',
        '막연한 결심보다 "눈에 보이는 목표"와 "구체적 상황별 대체행동"이 금연 성공률을 높입니다.', SRC.noSmokeGuide),
    ],
  },
  {
    key: 'alcohol', title: '절주', emoji: '🍺', category: 'ETC',
    questions: [
      ox('술은 1g당 7kcal로, 같은 무게의 밥·고기(4kcal)보다 열량이 높다. 소주 1병이면 밥 한 공기를 훌쩍 넘는 칼로리다.', 'O',
        '알코올은 영양가 없이 열량만 높고(1g=7kcal), 몸이 술을 먼저 분해하느라 그동안 지방은 안 타고 쌓입니다. "술은 살 안 쪄"는 가장 흔한 착각입니다.', SRC.alcoholKcal),
      mc('회식 다음 날, 종일 머리가 멍하고 일이 손에 안 잡힌 경험이 있다면 그 이유로 가장 정확한 것은?',
        ['술이 숙면을 방해해 깊은 잠을 못 자기 때문', '술은 오히려 잠을 깊게 해줘서', '다음 날 피로와 술은 무관', '물을 적게 마셔서일 뿐'], 0,
        '술은 잠들기는 쉽게 해도 깊은 수면(렘수면)을 방해해, 자도 잔 것 같지 않게 만듭니다. 어제의 한 잔이 오늘의 업무를 깎습니다.', SRC.kdcaDrink),
      ox('암 예방 관점에서 "안전한 음주량"은 따로 없으며, 하루 한두 잔의 소량도 위험을 높일 수 있다.', 'O',
        'WHO는 "안전한 음주량은 없다"고 봅니다. 알코올의 분해산물은 담배·석면과 같은 1군 발암물질입니다.', SRC.kdcaDrink),
      mc('회식에서 분위기를 깨지 않으면서 절주 의사를 전하는 말로 가장 자연스러운 것은?',
        ['"건강검진 결과 때문에 조절 중이라, 오늘은 제가 분위기 챙길게요!"', '"저 술 안 마십니다. 권하지 마세요."', '"다들 마시는데 저만 빠지긴 좀..."', '"한 잔만 더 주세요, 못 마시지만"'], 0,
        '거절을 "관계 단절"이 아니라 "다른 방식의 참여"로 바꾸면 분위기도 건강도 지킵니다. 이유를 들고 대신 할 역할을 제안하는 게 잘 통합니다.', SRC.drinkPractice),
      sa('"회식에서 OO하면 과음하게 된다"는 나의 패턴을 떠올려보고, 그 상황에서 미리 정해둘 절주 규칙을 1가지 적어보세요.',
        '예: 분위기에 휩쓸려 원샷 → "물잔 옆에 두고 술은 반잔씩, 1차만"',
        '폭음은 대개 "특정 상황"에서 반복됩니다. 규칙을 미리 정해두면 그 순간 의지력 싸움 대신 작전을 실행하면 됩니다.', SRC.drinkPractice),
    ],
  },
  {
    key: 'nutrition', title: '영양', emoji: '🥗', category: 'DIET',
    questions: [
      mc('편의점·구내식당에서 점심을 고를 때, 오후 졸음을 가장 적게 부르는 조합은?',
        ['단백질·채소 위주(닭가슴살 샐러드, 백반+나물)', '라면+삼각김밥+탄산', '컵라면+초코바', '크림파스타+단 음료'], 0,
        '정제 탄수화물·당이 많은 점심은 혈당을 급격히 올렸다 떨어뜨려 "식곤증"을 부릅니다. 단백질·채소·통곡물 위주면 오후 집중력이 유지됩니다.', SRC.kdcaCarb),
      ox('국·찌개·라면 국물을 다 마시는 습관은 하루 나트륨 권고량을 훌쩍 넘기게 만들어, 혈압·붓기·체중에 부담을 준다.', 'O',
        '한국인은 국물·김치·가공식품으로 WHO 권고(하루 2,000mg)의 1.5배 이상 나트륨을 먹습니다. 국물을 남기는 것만으로도 상당량을 줄일 수 있습니다.', SRC.kdcaSodium),
      ox('커피를 아무리 많이 마셔도 부족한 잠을 대신할 수 없고, 오후 늦은 카페인은 오히려 밤잠을 방해해 다음 날 더 피곤하게 만든다.', 'O',
        '카페인은 졸음을 잠깐 미룰 뿐 수면을 대체하지 못합니다. 오후 늦게 마시면 밤잠을 방해하고, 다음 날 또 커피를 찾는 악순환이 생깁니다.', SRC.mfdsCaffeine),
      mc('에너지음료를 입에 달고 사는 동료에게 알려줄 식약처 성인 카페인 하루 권고량(커피로 환산 시)은?',
        ['커피 약 1잔(100mg)', '커피 약 4잔(400mg)', '커피 약 10잔(1,000mg)', '제한 없음'], 1,
        '식약처 성인 권고량은 하루 400mg(커피 약 4잔). 에너지음료 1캔에도 상당량이 들어 있어 커피와 합치면 쉽게 초과합니다.', SRC.mfdsCaffeine),
      sa('오후 3시 피로가 몰려올 때 무심코 집는 과자·단 음료를 떠올려보고, 그것을 대신할 더 나은 간식 1가지와 "언제 미리 챙겨둘지"를 적어보세요.',
        '예: 초코바 → 견과 한 봉지, 출근길에 미리 사서 서랍에 두기',
        '의지로 참기보다 "건강한 선택을 미리 눈앞에 두는 것"이 효과적입니다. 서랍 속 견과 하나가 자판기 앞 결정을 바꿉니다.', SRC.kdcaNutrition),
    ],
  },
  {
    key: 'activity', title: '신체활동', emoji: '🏃', category: 'WALKING',
    questions: [
      ox('하루 종일 앉아 일하면, 퇴근 후 운동을 하더라도 종일 앉아 있던 위험이 충분히 사라지지 않는다. "앉아 있기는 새로운 흡연"이라 불린다.', 'O',
        '여러 연구에서 장시간 좌식은 운동만으로 충분히 상쇄되지 않는 것으로 보고됩니다. 30~60분마다 일어나 잠깐 움직이는 게 중요합니다.', SRC.kdcaPhysical),
      ox('바쁜 날에는 한 번에 30분을 못 내도, 10분씩 3번 나눠 걸어도 신체활동 효과를 쌓을 수 있다.', 'O',
        '운동은 "몰아서 길게"만 효과 있는 게 아닙니다. 10분씩 나눠도 쌓이면 효과가 있습니다.', SRC.kdcaExercise),
      mc('세계보건기구(WHO)가 권하는 성인의 일주일 운동량으로, 생각보다 부담 없는 기준은?',
        ['매일 2시간 이상', '주당 중강도 150분(하루 20~30분꼴)', '주 10분이면 충분', '운동 기준은 없다'], 1,
        'WHO 권고는 주당 중강도 150분, 하루로 치면 빠르게 걷기 20~30분 수준입니다. "점심 산책 + 한 정거장 걷기"로도 채울 수 있습니다.', SRC.kdcaExercise),
      mc('사무실에서 "가만히 있으면 자꾸 안 움직이게 되는" 습관을 바꾸는, 가장 현실적인 방법은?',
        ['엘리베이터 대신 계단을 기본 동선으로 정하기', '매일 헬스장 2시간 결심하기', '주말에 몰아서 등산', '운동은 포기하기'], 0,
        '의지로 "운동하자"보다, 가만히 있어도 움직이게 되는 환경을 만드는 게 오래갑니다. 작은 설정이 하루 활동량을 늘립니다.', SRC.kdcaPhysical),
      sa('근무 중 "이 신호가 오면 일어나서 움직인다"는 나만의 규칙을 정해보세요. (예: 화장실 갈 때마다 계단 한 층, 점심 후 10분 걷기)',
        '예: 1시간마다 알림 울리면 일어나 물 뜨러 가기 + 점심 후 건물 한 바퀴',
        '"많이 움직여야지"보다 "OO하면 일어선다"는 구체적 신호가 실제로 몸을 움직이게 합니다.', SRC.kdcaPhysical),
    ],
  },
  {
    key: 'musculo_eye', title: '근골격계·눈건강', emoji: '💺', category: 'ETC',
    questions: [
      mc('고개를 숙여 모니터·스마트폰을 볼 때, 목에 실리는 무게는 바른 자세(약 5kg)에서 60도 숙이면 얼마까지 늘까? (질병관리청 기준)',
        ['약 7kg', '약 12kg', '약 27kg', '변화 없음'], 2,
        '질병관리청에 따르면 15도 숙이면 12kg, 30도 18kg, 60도면 27kg까지 늘어납니다. 거북목·어깨 통증에는 이유가 있습니다.', SRC.kdcaTurtle),
      ox('손목·어깨 통증이 반복되는데 "참다 보면 낫겠지" 하고 같은 자세로 버티면, 오히려 만성 통증·디스크로 악화될 수 있다.', 'O',
        '반복되는 통증을 방치하면 만성화되기 쉽습니다. 통증은 자세·도구·휴식을 점검하라는 몸의 신호입니다. 일찍 손보는 게 비용을 줄입니다.', SRC.kdcaTurtle),
      ox('하루 종일 컴퓨터·스마트폰 화면을 보는 작업은 목·어깨·손목 통증뿐 아니라 눈의 피로·시야 흐림과도 관련된다.', 'O',
        'VDT(영상표시단말기) 작업은 근골격계 통증과 함께 눈 피로·건조를 부릅니다. 안전보건공단은 50분 작업 후 10분 휴식, 화면과 50cm 이상 거리를 권합니다.', SRC.vdtGuideLaw),
      mc('눈 피로를 줄이는 "20-20-20 규칙"으로 가장 적절한 것은?',
        ['20분마다 20피트(6m) 떨어진 곳을 20초간 바라보기', '20분마다 눈 감고 20초 자기', '하루 20분만 일하기', '화면 밝기를 20%로'], 0,
        '20분 작업 후 약 6m 먼 곳을 20초간 바라보면 눈 근육의 긴장이 풀립니다. 잠깐 창밖을 보는 것만으로 눈이 쉽니다.', SRC.kdcaDryEye),
      sa('내 자리에서 목·어깨·눈 부담을 줄이려고 오늘 바로 바꿀 수 있는 것 1가지를 적어보세요. (예: 모니터 높이기, 50분마다 창밖 보기)',
        '예: 모니터 위가 눈높이에 오게 받침대 놓기 + 50분마다 일어나 목 돌리기',
        '비싼 의자보다 "지금 당장 바꿀 수 있는 한 가지"가 통증을 줄입니다.', SRC.kdcaTurtle),
    ],
  },
  {
    key: 'sleep', title: '수면·피로관리', emoji: '😴', category: 'SLEEP',
    questions: [
      ox('잠들기 직전 스마트폰의 밝은 화면을 보면, 잠을 부르는 호르몬(멜라토닌)이 억제돼 오히려 잠이 더 안 온다.', 'O',
        '밤의 밝은 빛(특히 블루라이트)은 멜라토닌 분비를 막아 수면 리듬을 늦춥니다. 자기 30분 전 화면을 끄는 것만으로 잠들기가 쉬워집니다.', SRC.nhisMelatonin),
      mc('"4~5시간만 자도 충분하다"며 버티는 직장인이 놓치는 사실로 가장 정확한 것은?',
        ['수면 부족은 집중력·판단력을 술 취한 수준까지 떨어뜨릴 수 있다', '잠은 적게 잘수록 단련된다', '성인은 4시간이면 충분하다', '수면과 업무능력은 무관'], 0,
        '만성 수면 부족은 음주 상태와 비슷한 수준으로 집중력·반응속도·판단력을 떨어뜨립니다. 성인은 평균 7~8시간이 필요합니다(개인차 있음).', SRC.nhisSleepLack),
      ox('야간·교대근무 후 낮에 잘 때는, 빛을 최대한 차단하고(암막) 소음을 줄이면 수면의 질이 올라간다.', 'O',
        '우리 몸은 빛을 "깰 시간"으로 인식하므로, 낮잠 환경을 밤처럼 어둡고 조용하게 만들면 회복이 빨라집니다. 암막커튼·안대·귀마개가 도움이 됩니다.', SRC.nhisSleepHygiene),
      mc('오후 늦게 마신 커피가 밤잠을 방해하는 이유로 가장 정확한 것은?',
        ['카페인은 몸에서 절반 줄어드는 데만 몇 시간 걸려, 늦게 마시면 밤까지 각성이 남는다', '카페인은 1시간이면 다 빠진다', '커피는 수면과 무관', '카페인은 잠을 깊게 한다'], 0,
        '카페인은 반감기가 길어 오후 늦게 마시면 잠자리에서도 각성이 남습니다. 오후엔 디카페인·물로 바꾸는 게 밤잠을 지키는 길입니다.', SRC.mfdsCaffeine),
      sa('퇴근 후 잠을 방해하지 않기 위한 나만의 "잠자기 전 30분 루틴"을 1가지 정해보세요. (예: 폰은 거실에 두기, 따뜻한 물 샤워)',
        '예: 23시 이후 폰은 거실 충전 + 미지근한 물 샤워 후 스탠드만 켜기',
        '"잘 준비 신호"를 정해두면 몸이 자동으로 수면 모드로 들어갑니다. 매일 같은 루틴이 수면 리듬을 안정시킵니다.', SRC.nhisSleepHygiene),
    ],
  },
  {
    key: 'job_stress', title: '직무스트레스', emoji: '🧠', category: 'MINDCARE',
    questions: [
      mc('번아웃을 의심해볼 수 있는 대표적 신호로 가장 적절한 것은?',
        ['일에 대한 무기력·냉소, 출근만 생각하면 소진되는 느낌이 2주 이상', '가끔 피곤한 것', '바쁜 날 야근하는 것', '월요일이 싫은 것'], 0,
        '번아웃은 단순 피로가 아니라 정서적 소진·냉소·효능감 저하가 지속되는 상태입니다. 2주 이상 지속되면 신호로 보고 돌봐야 합니다.', SRC.nhisBurnout),
      ox('번아웃은 개인의 의지가 약해서가 아니라, 과도한 업무량·낮은 재량·부족한 지지 같은 일터 환경과 깊이 관련된다.', 'O',
        '직무스트레스는 "마음 다잡으면" 해결되는 개인 문제가 아닙니다. 구조가 핵심이라 조직 차원의 개선·도움 요청이 필요합니다. 자책할 일이 아닙니다.', SRC.nhisBurnout),
      ox('회사에서 심리상담을 받으면 소문이나 인사 불이익이 걱정되지만, 근로자지원프로그램(EAP) 상담은 법으로 익명성·비밀이 보장된다.', 'O',
        '근로복지기본법 제83조는 EAP 참여자의 익명성 보장을 명시합니다. 근로복지공단 EAP는 개인 연 7회까지 무료 상담을 제공하고 내용은 회사에 공유되지 않습니다.', SRC.eapLaw),
      mc('평소 밝던 동료가 부쩍 지쳐 보이고 "다 그만두고 싶다"는 말을 자주 한다. 가장 바람직한 행동은?',
        ['진지하게 안부를 묻고, 혼자 두지 말고 상담 자원(EAP·109)을 함께 알아본다', '괜한 참견 같아 모른 척한다', '"다들 힘들어, 참아"라고 말한다', '소문날까 봐 다른 동료에게 먼저 말한다'], 0,
        '전문가가 아니어도 됩니다. 직접 안부를 묻는 것이 위험을 키우지 않고, 혼자가 아니라는 안도감을 줍니다. 곁의 관심과 자원 연결만으로 큰 힘이 됩니다.', SRC.counsel109),
      sa('스트레스가 한계에 다다랐을 때 쓸 "나만의 회복 행동" 1가지와, "이때는 도움을 청한다"는 나만의 기준을 적어보세요.',
        '예: 점심에 혼자 산책하며 음악 듣기 / 2주 넘게 무기력하면 EAP·109 상담',
        '위기 전에 "내 회복법"과 "도움 청할 기준선"을 정해두면, 막상 힘들 때 더 쉽게 손을 내밀 수 있습니다.', SRC.nhisBurnout),
    ],
  },
  {
    key: 'oral', title: '구강건강', emoji: '🦷', category: 'ETC',
    questions: [
      ox('잇몸병(치주질환)은 감기를 제치고, 우리나라 사람들이 외래 진료로 병원을 가장 많이 찾는 질환 1위를 여러 해째 차지하고 있다.', 'O',
        '건강보험심사평가원 통계에서 치은염·치주질환은 2019년 이후 외래 다빈도 1위입니다. 흔하지만 젊을수록 방치하기 쉽습니다.', SRC.hiraStat),
      ox('잇몸병(치주질환)은 입속 문제로 끝나지 않고, 심혈관질환·당뇨 등 전신 건강과도 관련된다.', 'O',
        '질병관리청은 치주질환이 심혈관질환·당뇨·류마티스관절염 등과 연관된다고 밝힙니다. 양치가 곧 전신 건강 관리입니다.', SRC.kdcaPerio),
      ox('커피·흡연으로 한번 누렇게 착색된 치아는 양치를 열심히 하거나 담배를 끊어도 원래 색으로 잘 돌아오지 않는다.', 'O',
        '착색물질이 치아에 배면 양치나 금연만으로는 원색으로 돌아오기 어렵고 전문 미백이 필요합니다. 착색을 만들지 않는 게 싸고 확실합니다.', SRC.toothStain),
      mc('점심 후 칫솔질이 어려운 사무실에서, 구취·충치를 줄이는 현실적인 임시 대처로 가장 좋은 것은?',
        ['물로 입안을 헹구고, 무가당 껌(자일리톨)을 씹는다', '민트사탕을 계속 빨아먹는다', '커피를 더 마셔 냄새를 덮는다', '그냥 둔다'], 0,
        '양치가 어려우면 물 헹굼 + 무가당 껌이 차선책입니다. 침 분비를 늘려 입속 세균·산을 줄입니다. 당이 든 사탕은 오히려 충치를 키웁니다.', SRC.kdcaOralCare),
      sa('직장 생활 중 구강 건강을 지키기 위해 오늘부터 더 챙길 습관 1가지를 적어보세요. (예: 점심 후 물 헹굼, 자기 전 치실, 연 1회 스케일링 예약)',
        '예: 자기 전 치실 한 번 추가 + 올해 안 받은 스케일링 예약하기',
        '양치만으로는 치아 사이 세균을 다 못 잡습니다. 치실과 건강보험 스케일링(연 1회)으로 잇몸병을 미리 막을 수 있습니다.', SRC.kdcaOralCare),
    ],
  },
  {
    key: 'addiction', title: '중독·디지털사용', emoji: '📱', category: 'MINDCARE',
    questions: [
      ox('온라인 불법도박은 "소액이라 괜찮다"고 생각하기 쉽지만, 금액과 상관없이 형사처벌 대상이 될 수 있고 전과·벌금이 남을 수 있다.', 'O',
        '도박은 금액 크기보다 통제력 상실·반복성이 핵심이며, 불법도박은 소액이라도 처벌 대상입니다. 어려우면 1336으로 상담하세요.', SRC.gambleLaw),
      mc('도박·게임·충동소비를 줄이려 할 때, "의지로 참기"보다 효과적인 전략은?',
        ['앱 차단·결제수단 분리·사용시간 제한 같은 "장벽"을 미리 만든다', '손실을 만회하려 더 크게 한판', '월급날마다 몰아서 결제', '잠을 줄여 더 오래 한다'], 0,
        '중독성 행동은 순간의 의지로 막기 어렵습니다. "하기 어렵게 만드는 장벽"이 훨씬 효과적입니다. 환경을 바꾸면 의지력 싸움을 줄일 수 있습니다.', SRC.smartRest),
      ox('퇴근 후 침대에서 숏폼·게임을 하다 보면 어느새 새벽인 경험, 이는 수면 시간을 갉아먹어 다음 날 컨디션을 망친다.', 'O',
        '"조금만 더"가 반복되며 수면을 잠식합니다. 침실 밖 충전, 사용시간 알림 같은 경계선이 잠과 다음 날을 지킵니다.', SRC.mentalSleep),
      ox('도박·과음 문제로 힘들어 보이는 동료에게, 비난 대신 "이런 상담 창구가 있더라"라고 정보를 건네는 것만으로도 도움이 될 수 있다.', 'O',
        '도박문제 헬프라인 1336은 본인·가족·동료 누구나 익명으로 상담할 수 있습니다. 조심스러운 정보 한마디가 회복의 계기가 됩니다.', SRC.gambleHelp1336),
      sa('퇴근 후 스마트폰·게임·도박 사용을 줄이기 위한 나만의 "경계선"을 1가지 정해보세요. (예: 침실에 폰 안 두기, 23시 이후 앱 차단)',
        '예: 잘 땐 폰 거실에 충전 + 게임 결제앱 삭제하고 한 달 살아보기',
        '"물리적 경계선"이 효과적입니다. "하기 번거롭게" 만들면 자연히 줄어듭니다. 힘들면 1336에 도움을 청하세요.', SRC.smartRest),
    ],
  },
  {
    key: 'cardio', title: '심뇌혈관·대사건강', emoji: '❤️', category: 'ETC',
    questions: [
      ox('고혈압은 대부분 증상이 없어, 혈압을 재보기 전에는 본인이 고혈압인지 알기 어렵다. 그래서 "침묵의 살인자"로 불린다.', 'O',
        '고혈압은 수치가 꽤 높아도 증상이 없는 경우가 많아 모른 채 혈관이 손상됩니다. 증상이 없어서 더 위험합니다. 건강검진의 혈압 수치를 꼭 확인하세요.', SRC.bpSixRules),
      ox('젊은 직장인도 자극적인 배달음식·잦은 음주·운동부족이 쌓이면 20·30대에 고혈압이 생길 수 있다.', 'O',
        '20·30대 고혈압 유병자가 빠르게 늘고 있고, 젊은 고혈압은 생활습관 영향이 큽니다. 젊을수록 인지율이 낮아 방치되기 쉬운 게 더 위험합니다.', SRC.bpSixRules),
      mc('직장 건강검진에서 혈압·혈당·콜레스테롤(이상지질혈증)이 높게 나왔을 때 가장 적절한 행동은?',
        ['"바쁘니 나중에"가 아니라, 재검·생활습관 개선·필요시 진료로 바로 이어간다', '증상 없으니 무시한다', '민간요법부터 찾아본다', '검진을 다시 안 받는다'], 0,
        '검진 결과는 "지금 손쓰면 막을 수 있다"는 신호입니다. 이상지질혈증·고혈압·당뇨는 심근경색·뇌졸중의 직접 위험요인입니다.', SRC.redCircle),
      mc('혈압 관리를 위해 회식·점심에서 바꿀 수 있는 가장 효과적인 한 가지는?',
        ['국물·찌개 국물을 남기고 싱겁게 먹기', '국물까지 싹 비우기', '짠 안주에 술 곁들이기', '물 대신 탄산음료'], 0,
        '한국인 혈압의 큰 적은 나트륨이고 그 주범이 국물입니다. 국물을 남기는 것만으로 나트륨 섭취를 크게 줄일 수 있습니다.', SRC.cvdNineRules),
      sa('혈압·혈당 관리를 위해 직장 생활에서 실천할 행동 1가지와, "마지막으로 혈압 잰 게 언제인지"를 떠올려 적어보세요.',
        '예: 라면 국물 남기기 + 다음 검진 때 혈압·콜레스테롤 꼭 확인',
        '고혈압은 재봐야 압니다. 수치를 확인하고 생활습관을 조정하는 것만으로 수십 년 뒤 심근경색·뇌졸중 위험을 크게 낮출 수 있습니다.', SRC.cvdNineRules),
    ],
  },
  {
    key: 'cancer', title: '암예방·검진', emoji: '🎗️', category: 'ETC',
    questions: [
      mc('국가암검진은 "바쁘다"고 미루기 쉽지만, 조기 발견 시 치료 성과가 크게 달라진다. 검진의 핵심 이점으로 가장 정확한 것은?',
        ['증상이 나타나기 전 초기에 발견해 완치율을 높인다', '암을 예방해 안 걸리게 한다', '검진만 받으면 치료가 필요 없다', '검진은 효과가 없다'], 0,
        '암검진의 힘은 "증상 전 조기 발견"입니다. 많은 암이 초기엔 증상이 없어, 일찍 찾으면 완치율이 크게 올라갑니다.', SRC.cancerScreening),
      ox('암 예방을 위해서는 하루 한두 잔의 소량 음주도 피하는 것이 권고된다.', 'O',
        '국가 암예방 수칙과 WHO는 "안전한 음주량은 없다"고 봅니다. 알코올은 1군 발암물질로 소량도 여러 암 위험을 높입니다.', SRC.drinkPractice),
      ox('국가암검진 안내문을 받으면, 바쁘더라도 대상 검진을 확인하고 받는 것이 중요하다. 대부분 무료이거나 소액 본인부담이다.', 'O',
        '국가암검진은 부담이 적고 받아두면 큰 병을 일찍 잡을 수 있습니다. 받은 김에 바로 예약하는 게 요령입니다.', SRC.cancerTarget),
      mc('국민 암예방 수칙에 포함되는 생활습관으로 가장 적절한 것은?',
        ['금연·절주, 채소·과일 충분히, 규칙적 운동, 검진 챙기기', '담배는 줄이기만', '술은 독한 것만 피하기', '검진은 아플 때만'], 0,
        '국가 암예방 수칙의 핵심은 금연·절주·균형식·운동·검진입니다. 이미 다른 주제에서 다룬 생활습관들이 그대로 암 예방이 됩니다.', SRC.cancerPrevent),
      sa('올해 내가 받아야 할 국가암검진(또는 건강검진)이 있는지 확인하고, "언제 예약할지" 구체적 날짜·방법을 적어보세요.',
        '예: 이번 달 안에 위내시경 예약 / 검진 안내문 확인 후 회사 근처 병원 예약',
        '"언제·어디서 예약"이라는 구체적 계획이 실제 행동을 만듭니다. 날짜를 정하는 순간 실천 확률이 크게 올라갑니다.', SRC.cancerScreening),
    ],
  },
  {
    key: 'obesity', title: '비만·체중관리', emoji: '⚖️', category: 'ETC',
    questions: [
      ox('같은 체중이라도 뱃속(내장)에 지방이 몰린 "복부비만"은 당뇨·고혈압·심뇌혈관질환 위험과 더 강하게 연결된다. 체중계 숫자보다 허리둘레가 중요할 수 있다.', 'O',
        '내장지방형 복부비만은 혈관·대사에 직접 부담을 줘, 마른 체형이어도 배만 나온 "마른 비만"이 위험할 수 있습니다. 허리둘레를 함께 봐야 합니다.', SRC.kdcaObesity),
      mc('굶어서 단기간에 살을 확 뺐다가 다시 찌는 "요요"의 핵심 원인으로 맞는 것은?',
        ['급격한 감량으로 근육·기초대사량이 줄어, 예전처럼 먹으면 더 쉽게 살찌는 몸이 되기 때문', '살이 원래 자리로 가려는 의지', '물을 많이 마셔서', '요요는 근거 없는 미신'], 0,
        '급격히 굶으면 지방과 함께 근육이 빠져 기초대사량이 낮아지고, 이 상태에서 예전처럼 먹으면 남는 에너지가 지방으로 쌓입니다. 천천히가 정답입니다.', SRC.nhisDietHarm),
      ox('체중 관리는 체중계 숫자만 보면 충분하고, 허리둘레·근육량·식습관은 볼 필요가 없다.', 'X',
        '체중계 숫자가 줄어도 근육 손실이면 오히려 요요에 취약해집니다. 중요한 건 "체성분(근육 대 지방)"과 허리둘레입니다.', SRC.nhisDietHealthy),
      mc('야근 후 배달음식·야식을 줄이기 위한 가장 현실적인 전략은?',
        ['야식 충동이 오는 시간·상황을 미리 알고 대체 행동(따뜻한 차·일찍 잠자리)을 정해둔다', '배고프면 무조건 참기', '야식을 끊겠다고 결심만 한다', '더 많이 굶어서 보상받기'], 0,
        '충동이 오는 패턴을 알고 미리 대안을 준비하는 게 효과적입니다. 야식 앱 삭제, 따뜻한 차, 일찍 눕기 같은 "환경 설계"가 충동을 줄입니다.', SRC.nhisDietHealthy),
      sa('"빨리 빼기"가 아니라 "꾸준히"를 위해, 이번 주에 실천할 작고 지속 가능한 행동 1가지를 적어보세요. (예: 야식 주 2회로, 점심 후 10분 걷기)',
        '예: 평일 야식은 주 1회만 + 엘리베이터 대신 계단 쓰기',
        '건강한 체중 관리의 핵심은 "오래 갈 수 있는 작은 습관"입니다. 거창한 결심은 며칠 가지만 작은 한 가지는 평생 갑니다.', SRC.nhisDietHealthy),
    ],
  },
]

// ─── 일반 성인 대상 ───────────────────────────────────
//   범용 건강 상식(대부분 운영자의 기본 대상). 프리셋 카테고리(금연·영양·신체활동·수면·마음건강)에 맞춤.
//   출처: 근로자 섹션의 검증된 공공기관 URL 재사용(주제 일치분). 마음건강은 신규.
//   ⚠️ 문항·해설은 확립된 공중보건 상식 기반 초안 — 배포 전 의학 검수·출처 확정 권장.
const GENERAL_TOPICS = [
  {
    key: 'smoking', title: '금연', emoji: '🚭', category: 'NO_SMOKING',
    questions: [
      mc("흡연이 원인이 될 수 있는 질환으로 알맞지 않은 것은?",
        ["폐암·후두암 등 여러 부위의 암", "만성폐쇄성폐질환(COPD)", "심장병 등 심혈관 질환", "세균 감염으로만 생기는 단순 감기"], 3,
        "흡연은 폐암뿐 아니라 구강·후두·식도·방광암 등 다양한 암과 심장병, COPD의 주요 원인입니다. 오늘 한 개비를 줄이는 것도 위험을 낮추는 시작입니다.",
        "https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5299"),
      mc("흡연 욕구(갈망)가 올라올 때 도움이 되는 대처법으로 보기 어려운 것은?",
        ["몇 분간 피우지 않고 시간 미루기", "물이나 무설탕 껌으로 입 달래기", "가벼운 산책이나 심호흡하기", "흡연하던 장소에 일부러 오래 머무르기"], 3,
        "갈망은 대개 몇 분이면 지나가므로 시간 미루기·물 마시기·자리 이동·심호흡이 효과적입니다. 흡연을 연상시키는 장소는 피하세요.",
        "https://www.mayoclinic.org/diseases-conditions/nicotine-dependence/in-depth/nicotine-craving/art-20045454"),
      mc("금연 후 니코틴 금단 증상은 대체로 언제 가장 심한가?",
        ["끊은 지 2~3일째", "끊은 지 2주 후", "끊은 지 2개월 후", "끊자마자 바로 사라짐"], 0,
        "금단 증상은 마지막 흡연 후 수 시간 내 시작되어 2~3일째 정점을 찍고 이후 수 주에 걸쳐 완화됩니다. 가장 힘든 고비가 며칠뿐임을 알면 버티기 쉽습니다.",
        "https://my.clevelandclinic.org/health/diseases/21587-nicotine-withdrawal"),
      mc("금연을 시작하면 몸은 얼마나 빨리 회복을 시작할까?",
        ["약 20분 내에 심박수와 혈압이 내려가기 시작", "최소 1년은 지나야 변화 시작", "최소 5년은 지나야 변화 시작", "평생 회복되지 않음"], 0,
        "마지막 담배 후 약 20분이면 심박수·혈압이 떨어지기 시작하고 12시간이면 혈중 일산화탄소가 정상화됩니다. 지금 끊으면 오늘 안에 회복이 시작됩니다.",
        "https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation"),
      // 🩺 의학 확인 권장
      mc("장기 금연 유지에 가장 효과적인 방법으로 알려진 것은?",
        ["상담(행동요법)과 금연 약물을 함께 사용", "의지력에만 의존하기", "약물 없이 참기만 하기", "한 번 실패하면 포기하기"], 0,
        "상담은 흡연과 연결된 습관 대처법을 익히게 하고 니코틴 대체요법 등 약물은 갈망·금단을 줄여, 둘을 병행하면 성공률이 높습니다. 보건소 금연상담·금연치료를 활용해 보세요.",
        "https://www.ncbi.nlm.nih.gov/books/NBK555596/"),
      // 🩺 의학 확인 권장
      mc("WHO에 따르면 30세에 금연할 경우 계속 흡연하는 경우보다 대략 얼마의 기대수명을 되찾을 수 있나?",
        ["약 10년", "약 6개월", "약 2주", "차이 없음"], 0,
        "30세에 끊으면 약 10년, 40세엔 9년, 50세엔 6년의 기대수명을 회복할 수 있습니다. 어느 나이에 끊어도 이득이지만 빠를수록 좋습니다.",
        "https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation"),
      mc("흡연 중독의 의학적 핵심으로 가장 알맞은 설명은?",
        ["담배 속 니코틴에 대한 의존이 핵심이다", "순전히 의지가 약해서 생기는 문제다", "담배 연기의 냄새 때문에만 끊기 어렵다", "한번 피우면 무조건 평생 못 끊는다"], 0,
        "니코틴은 뇌의 보상 회로를 자극해 도파민을 분비시키고 반복 사용 시 의존을 만듭니다. 금연은 의지 문제가 아니라 중독을 다루는 과정이며 재발도 흔하니 자책 대신 전략을 준비하세요.",
        "https://nida.nih.gov/publications/research-reports/tobacco-nicotine-e-cigarettes/nicotine-addictive"),
      ox("간접흡연(2차 흡연)에는 안전한 노출 수준이 존재한다.", "X",
        "간접흡연에는 안전한 노출 수준이 없습니다. 비흡연자에게도 폐암·심혈관질환을, 어린이에게는 영아돌연사·천식 발작 등을 유발합니다.",
        "https://www.who.int/news-room/fact-sheets/detail/tobacco"),
      ox("금연 도중 다시 담배를 피우게 된 재발은 곧 완전한 실패를 뜻한다.", "X",
        "재발은 실패가 아니라 금연 과정의 흔한 단계입니다. 많은 사람이 여러 번 시도 끝에 성공하니, 위험 요인을 파악해 다음 전략을 세우면 됩니다.",
        "https://smokefree.gov/challenges-when-quitting/stick-with-it/slips-happen"),
      // 🩺 의학 확인 권장
      ox("금연 1년이 지나면 심장질환(관상동맥질환) 위험이 흡연자의 약 절반으로 줄어든다.", "O",
        "금연 1년 후 관상동맥질환 위험은 흡연자의 약 절반으로 낮아지고, 시간이 더 지나면 뇌졸중·폐암 위험도 크게 감소합니다.",
        "https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation"),
      ox("금연 후 나타나는 짜증·불안·집중력 저하 같은 금단 증상은, 몸이 니코틴 없이 적응해 가는 정상적인 과정이다.", "O",
        "짜증·불안·집중 곤란·식욕 증가 등은 몸이 니코틴 없이 적응하는 정상 반응이며 보통 수 주에 걸쳐 완화됩니다.",
        "https://www.cancer.gov/about-cancer/causes-prevention/risk/tobacco/withdrawal-fact-sheet"),
      ox("흡연 욕구(갈망)는 한번 시작되면 몇 시간씩 계속되기 때문에 참는 것은 사실상 불가능하다.", "X",
        "갈망은 대개 몇 분이면 지나갑니다. 즉시 피우지 않고 시간 미루기·물 마시기·심호흡으로 넘기면 됩니다.",
        "https://www.mayoclinic.org/diseases-conditions/nicotine-dependence/in-depth/nicotine-craving/art-20045454"),
      sa("담배 중독의 핵심으로, 뇌의 보상 회로를 자극해 도파민을 분비시키고 의존을 만드는 담배 속 물질의 이름은?",
        "니코틴",
        "니코틴은 뇌를 자극해 도파민을 분비시키고 반복 사용 시 신체적·정신적 의존을 만듭니다. 금연이 힘든 건 이 니코틴 중독 때문입니다.",
        "https://nida.nih.gov/publications/research-reports/tobacco-nicotine-e-cigarettes/nicotine-addictive"),
      sa("금연은 한 번에 끊는 단발성 사건이라기보다, 여러 번의 시도와 재발을 거칠 수 있는 하나의 ___이다. 빈칸에 들어갈 두 글자 단어는?",
        "과정 (여정 등 유사 정답 허용 권장)",
        "금연은 한 번의 사건이 아니라 과정입니다. 재발은 흔한 단계이며 학습의 기회로 삼을 수 있습니다.",
        "https://smokefree.gov/challenges-when-quitting/stick-with-it/slips-happen"),
    ],
  },
  {
    key: 'activity', title: '신체활동', emoji: '🏃', category: 'WALKING',
    questions: [
      mc("세계보건기구(WHO)가 권장하는 성인의 주간 중강도 유산소 운동량으로 가장 알맞은 것은?",
        ["주 30~60분", "주 150~300분", "주 500분 이상", "운동량은 정해진 기준이 없다"], 1,
        "WHO는 성인에게 매주 중강도 150~300분(또는 고강도 75~150분)의 유산소 활동을 권장합니다. 걷기·조깅으로 나눠 채워보세요.",
        "https://www.ncbi.nlm.nih.gov/books/NBK566046/"),
      mc("장비 없이 운동 강도를 가늠하는 말하기 테스트에서 중강도에 해당하는 상태는?",
        ["말도 노래도 편하게 할 수 있다", "말은 되지만 노래는 어려운 정도", "몇 마디 이상 이어 말하기 힘든 정도", "숨이 차서 한 마디도 못 한다"], 1,
        "중강도는 대화는 가능하지만 노래는 힘든 정도, 고강도는 몇 마디도 잇기 어려운 정도입니다. 초보라면 대화 가능한 중강도로 뛰어보세요.",
        "https://www.cdc.gov/physical-activity-basics/measuring/index.html"),
      mc("달리기 부상은 주로 신체 어느 부위에 집중되어 발생할까?",
        ["어깨·목", "허리·등", "무릎·정강이·발목·발 등 하지", "손목·팔"], 2,
        "달리기 부상의 약 4분의 3은 무릎·정강이·발목·발 등 하지에서 발생합니다. 종아리·허벅지 스트레칭으로 하지를 미리 풀어주세요.",
        "https://www.betterhealth.vic.gov.au/health/healthyliving/running-and-jogging-preventing-injury"),
      mc("러닝화를 교체할 시점을 점검하는 일반적 기준 주행 거리로 알맞은 것은?",
        ["50~100km", "약 500~800km(300~500마일)", "2000km 이상", "거리와 상관없이 1년마다"], 1,
        "보통 300~500마일(약 500~800km) 주행을 러닝화 교체 점검 기준으로 봅니다. 밑창이 닳거나 쿠션 탄력이 떨어지면 교체 신호예요. (경험칙이라 신발·주법에 따라 차이가 있습니다.)",
        "https://blog.bonsecours.com/sports/how-often-should-you-replace-running-shoes/"),
      mc("초보 러너가 과사용 부상을 피하기 위해 흔히 권장되는 주당 거리 늘리기 방식은?",
        ["매주 2배씩 늘린다", "몇 달에 걸쳐 조금씩 점진적으로 늘린다", "한 번에 최대한 많이 늘린다", "거리는 늘리지 않는다"], 1,
        "너무 갑자기, 너무 많이가 과사용 부상의 흔한 원인입니다. 몇 달에 걸쳐 서서히 늘리는 보수적 방식이 권장됩니다. (흔히 '주당 10% 이내'라는 경험칙도 쓰이지만 과학적으로 검증된 규칙은 아닙니다.)",
        "https://www.betterhealth.vic.gov.au/health/healthyliving/running-and-jogging-preventing-injury"),
      mc("유산소 운동에 더해 WHO가 병행을 권장하는 것과 그 빈도로 알맞은 것은?",
        ["근력 운동, 주 2회 이상", "고강도 인터벌, 매일", "단식, 주 3회", "스트레칭만, 월 1회"], 0,
        "WHO는 주 2일 이상 주요 근육을 쓰는 근력 운동을 권장합니다. 달리는 사람에게도 근력 운동은 부상 예방에 도움이 됩니다.",
        "https://www.ncbi.nlm.nih.gov/books/NBK566046/"),
      ox("권장 운동량에 못 미치더라도, 조금이라도 몸을 움직이는 것이 전혀 안 하는 것보다 건강에 이롭다.", "O",
        "WHO는 앉은 시간을 줄이고 가벼운 활동으로라도 대체하라고 권합니다. 짧은 걷기부터 시작해 점차 늘리면 됩니다.",
        "https://www.ncbi.nlm.nih.gov/books/NBK566046/"),
      ox("달리기 전에는 워밍업, 달린 뒤에는 스트레칭을 포함한 쿨다운을 하는 것이 좋다.", "O",
        "워밍업은 근육 온도와 혈류를 높여 손상 위험을 줄이고, 쿨다운은 회복을 돕습니다.",
        "https://www.betterhealth.vic.gov.au/health/healthyliving/running-and-jogging-preventing-injury"),
      ox("초보 러너는 처음부터 대화가 불가능한 고강도 페이스로 달려야 안전하다.", "X",
        "초보는 옆 사람과 대화가 가능한 편안한 중강도 페이스가 안전합니다. 편안한 페이스로 유산소 체력을 먼저 쌓으세요.",
        "https://www.cdc.gov/physical-activity-basics/measuring/index.html"),
      // 🩺 의학 확인 권장
      ox("달리기 중 통증이 자세를 바꾸게 하거나 첫 1마일 이후에도 계속되면, 참고 계속 달리는 것이 좋다.", "X",
        "그런 통증은 멈추라는 신호입니다. 하루 쉬는 것이 훈련을 망치지 않으니 휴식하고 필요하면 전문가 상담을 받으세요.",
        "https://www.betterhealth.vic.gov.au/health/healthyliving/running-and-jogging-preventing-injury"),
      ox("근력 운동은 달리기를 하는 사람에게도 부상 예방에 도움이 된다.", "O",
        "근력 운동은 근력·골밀도를 유지하고 낙상·부상을 예방해, 달리는 사람에게도 도움이 됩니다.",
        "https://www.ncbi.nlm.nih.gov/books/NBK566046/"),
      sa("장비 없이 대화 가능 여부로 운동 강도를 가늠하는 간단한 방법의 이름은?",
        "말하기 테스트 (토크 테스트 등 표기 허용 권장)",
        "말이 되면 중강도, 몇 마디도 잇기 힘들면 고강도로 판단하는 방법입니다. 장비 없이 스스로 강도를 조절할 수 있습니다.",
        "https://www.cdc.gov/physical-activity-basics/measuring/index.html"),
      sa("탈수를 막기 위해 달리기 전·중·후로 충분히 마셔야 하는 것은?",
        "물(수분)",
        "탈수는 운동 수행능력을 떨어뜨리고 부상·열 관련 위험을 높입니다. 달리기 전·중·후로 물을 충분히 마시세요.",
        "https://www.betterhealth.vic.gov.au/health/healthyliving/running-and-jogging-preventing-injury"),
    ],
  },
  {
    key: 'nutrition', title: '영양', emoji: '🥗', category: 'DIET',
    questions: [
      mc("WHO가 권하는 성인 하루 소금 섭취 상한은 대략 어느 정도일까요?",
        ["소금 1g 미만", "소금 5g 미만(티스푼 약 1개)", "소금 15g 미만", "제한 없음"], 1,
        "WHO는 하루 소금 5g(티스푼 약 1개) 미만을 권합니다. 나트륨 과다는 고혈압·심혈관질환의 주요 원인이니 국물은 남기고 소스는 찍어 드세요.",
        "https://www.who.int/news-room/fact-sheets/detail/healthy-diet"),
      mc("통곡물(현미·통밀 등)에 대한 권장으로 알맞은 것은?",
        ["곡물은 전부 정제 곡물로", "먹는 곡물의 최소 절반을 통곡물로", "통곡물은 피할 것", "통곡물은 하루 1회로 제한"], 1,
        "식생활지침은 먹는 곡물의 최소 절반을 통곡물로 하라고 권합니다. 통곡물은 심장질환·뇌졸중·2형 당뇨 위험 감소와 연관됩니다.",
        "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/whole-grains-refined-grains-and-dietary-fiber"),
      mc("하루 수분 필요량에 대한 설명으로 가장 정확한 것은?",
        ["물만 3L 이상 억지로 마셔야 한다", "음식·음료를 모두 합쳐 대략 여성 2.7L·남성 3.7L 정도다", "커피·차는 수분에서 완전히 제외된다", "수분은 많이 마실수록 무조건 좋다"], 1,
        "필요 수분은 음식·음료를 합친 총량으로 여성 약 2.7L·남성 약 3.7L 정도이며 약 20%는 음식에서 옵니다. 건강한 사람은 갈증에 맞춰 마셔도 충분합니다.",
        "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256"),
      ox("하루 수분은 반드시 맹물로만 채워야 한다.", "X",
        "수분은 물뿐 아니라 다른 음료와 음식(약 20%)에서도 채워집니다. 국·과일·채소도 수분 공급원이니 무리한 물 목표에 스트레스받지 않아도 됩니다.",
        "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256"),
      ox("첨가당(설탕 등)은 적게 먹을수록 건강에 더 이롭다.", "O",
        "WHO는 유리당을 총열량의 10% 미만으로, 나아가 5% 미만으로 줄이면 추가 이득이 있다고 봅니다. 가당 음료부터 줄여보세요.",
        "https://www.who.int/news-room/fact-sheets/detail/healthy-diet"),
      sa("WHO가 권하는 하루 과일·채소 최소 섭취량은 약 몇 그램(g)일까요?",
        "400g",
        "WHO는 심장질환·뇌졸중·일부 암 위험을 낮추기 위해 하루 최소 400g(합쳐 약 5회분)의 과일·채소를 권합니다.",
        "https://www.who.int/news-room/fact-sheets/detail/healthy-diet"),
      sa("WHO는 유리당(첨가당)을 하루 총열량의 몇 % 미만으로 줄이라고 권할까요?",
        "10% (숫자 10 허용)",
        "WHO는 유리당을 총에너지의 10% 미만으로 줄일 것을 강하게 권하고, 5% 미만이면 추가 이득이 있다고 봅니다.",
        "https://www.who.int/news-room/fact-sheets/detail/healthy-diet"),
    ],
  },
  {
    key: 'general', title: '생활 건강 상식', emoji: '💡', category: 'ETC',
    questions: [
      mc("성인에게 권장되는 일주일 유산소 운동 '최소' 시간은 얼마일까요? (중강도 기준)",
        ["주 30분", "주 60분", "주 150분", "주 300분"], 2,
        "CDC·WHO는 성인에게 주당 중강도 최소 150분을 권하며, 더 많은 이득을 위해 300분까지 늘리는 것도 권장됩니다(150~300분 범위). 하루 30분씩 주 5일로 시작해 보세요.",
        "https://www.cdc.gov/physical-activity-basics/guidelines/index.html"),
      mc("성인의 건강을 위해 권장되는 하룻밤 최소 수면 시간은?",
        ["5시간", "6시간", "7시간", "9시간"], 2,
        "18~60세 성인은 최소 7시간 수면이 권장됩니다. 7시간 미만이 이어지면 비만·당뇨·고혈압 위험이 올라갑니다.",
        "https://www.cdc.gov/sleep/data-research/facts-stats/adults-sleep-facts-and-stats.html"),
      mc("엘리베이터 대신 계단 오르기가 좋은 이유로 가장 알맞은 것은?",
        ["체온을 낮춰 준다", "심혈관 사망 위험 감소와 연관된다", "수면 시간을 늘려 준다", "소금 배출을 막아 준다"], 1,
        "대규모 메타분석에서 계단 오르기는 전체 사망 및 심혈관 사망 위험 감소와 연관됐습니다. 유산소와 근력을 동시에 챙기는 일상 운동입니다.",
        "https://academic.oup.com/eurjpc/article/31/Supplement_1/zwae175.405/7692518"),
      mc("유산소 운동 외에 성인에게 추가로 권장되는 운동과 그 빈도는?",
        ["근력 운동, 주 2회 이상", "스트레칭만, 매일", "달리기, 하루 3회", "별도 운동 불필요"], 0,
        "CDC는 유산소에 더해 주 2일 이상 근력 강화 운동을 권합니다. 스쿼트·팔굽혀펴기 같은 맨몸 운동부터 주 2회 시작해 보세요.",
        "https://www.cdc.gov/physical-activity-basics/guidelines/index.html"),
      ox("운동은 한 번에 몰아서 해야만 건강 효과가 있다.", "X",
        "한 번에 몰아 할 필요 없이 하루 30분씩 나눠도 되고, 조금이라도 움직이면 이득이 있습니다.",
        "https://www.cdc.gov/physical-activity-basics/guidelines/index.html"),
      ox("오래 앉아 있는 시간을 가벼운 활동으로라도 바꾸면 건강에 이롭다.", "O",
        "오래 앉아 있으면 사망률·심혈관질환·당뇨 위험이 올라가고, 가벼운 활동으로 앉은 시간을 대체하면 이득이 있습니다. 한 시간에 한 번은 일어나세요.",
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/"),
      ox("비누로 손을 제대로 씻는 것은 설사병·호흡기 감염 예방에 도움이 된다.", "O",
        "손씻기는 설사병 어린이 약 3명 중 1명, 호흡기 감염 어린이 약 5명 중 1명을 예방하는 것으로 추정됩니다. 가장 값싼 감염병 예방법입니다.",
        "https://www.cdc.gov/clean-hands/faq/index.html"),
      sa("비누와 물로 손을 씻을 때 권장되는 최소 시간은 약 몇 초일까요?",
        "20초 (숫자 20 허용)",
        "CDC는 비누로 약 20초간 손을 씻으면 세균과 화학물질이 효과적으로 제거된다고 안내합니다. 생일 축하 노래 2번 정도가 20초입니다.",
        "https://www.cdc.gov/clean-hands/faq/index.html"),
    ],
  },
  {
    key: 'mind', title: '마음건강', emoji: '🧘', category: 'MINDCARE',
    questions: [
      mc("정신건강과 기분을 위해 미국 CDC가 권장하는 성인의 하루 수면 시간은 얼마일까요?",
        ["4시간 이상", "5시간 이상", "7시간 이상", "10시간 이상"], 2,
        "CDC는 성인 권장 수면을 하루 7시간 이상으로 봅니다. 충분한 수면은 스트레스를 줄이고 기분을 개선하니 오늘 밤 30분 일찍 자보세요.",
        "https://www.cdc.gov/sleep/about/index.html"),
      mc("WHO가 성인(18~64세)에게 권장하는 주당 중강도 유산소 활동 시간은?",
        ["주 30분", "주 60분", "주 150~300분", "주 500분 이상"], 2,
        "WHO는 주당 최소 150~300분의 중강도 유산소 활동을 권장하며, 신체활동은 우울·불안 완화에 도움이 됩니다.",
        "https://www.who.int/news-room/fact-sheets/detail/physical-activity"),
      mc("WHO(ICD-11)가 정의한 번아웃의 세 가지 신호가 아닌 것은?",
        ["에너지 고갈(탈진)", "일에 대한 냉소·심리적 거리감", "직무 효능감 저하", "식욕 증가와 체중 변화"], 3,
        "번아웃은 탈진, 일에 대한 냉소·거리감, 직무 효능감 저하의 세 차원으로 정의됩니다. 이 신호를 알아차리는 것이 조기 대처의 출발점입니다.",
        "https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases"),
      mc("미국 공중보건서비스단 보고서에 따르면, 사회적 연결 부족이 조기 사망 위험을 높이는 정도는 하루 담배 몇 개비에 맞먹을 수 있다고 했을까요?",
        ["담배 3개비", "담배 15개비", "담배 40개비", "담배와 무관"], 1,
        "외로움과 사회적 고립은 하루 담배 15개비에 맞먹을 만큼 조기 사망 위험을 높일 수 있습니다. 사랑하는 사람과 시간을 보내는 것도 중요한 자기돌봄입니다.",
        "https://www.hhs.gov/surgeongeneral/reports-and-publications/connection/index.html"),
      mc("천천히 하는 깊은 호흡이 심박을 진정시키는 이유로, 자극되는 신경은?",
        ["좌골신경", "미주신경", "시신경", "삼차신경"], 1,
        "의도적으로 호흡을 늦추면 심박을 조절하는 미주신경이 자극되어 이완 반응이 일어납니다. 긴장될 때 숨을 천천히 내쉬어 보세요.",
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC8481564/"),
      mc("감정에 이름을 붙이는 감정 이름 붙이기가 정서 조절에 도움이 되는 이유는?",
        ["위협 감지 영역인 편도체 활동이 줄어든다", "심장 박동이 완전히 멈춘다", "감정을 영원히 없애준다", "잠을 자지 않아도 되게 한다"], 0,
        "지금 나는 불안하다처럼 감정에 이름을 붙이면 편도체 활동이 줄고 감정을 조절하는 전전두엽이 활성화됩니다. 힘들 때 감정을 한 단어로 불러보세요.",
        "https://pubmed.ncbi.nlm.nih.gov/17576282/"),
      mc("APA가 권장하는 건강한 스트레스 대처법으로 보기 어려운 것은?",
        ["통제할 수 없는 상황을 인정하기", "내 스트레스 트리거(유발 요인) 파악하기", "필요할 때 아니오라고 한계 설정하기", "모든 부탁을 무조건 다 들어주기"], 3,
        "APA는 통제 불가능한 상황 인정, 트리거 파악, 한계 설정, 심호흡·이완을 건강한 대처로 권합니다. 무리한 부탁엔 정중히 거절하는 연습을 해보세요.",
        "https://www.apa.org/topics/stress/tips"),
      ox("잠은 무조건 많이 잘수록 정신건강에 좋으므로 9시간 이상 자는 것이 가장 좋다.", "X",
        "수면이 5시간 이하로 짧거나 9시간 이상으로 너무 길어도 우울 위험이 늘어난다는 연구가 일관됩니다. 무작정 오래가 아니라 7시간 이상 규칙적으로가 핵심입니다.",
        "https://www.cdc.gov/sleep/about/index.html"),
      ox("WHO는 번아웃을 하나의 질병으로 분류하고 있다.", "X",
        "번아웃은 질병이 아니라 관리되지 않은 만성 직무 스트레스에서 오는 직업적 현상으로 분류됩니다. 신호를 알아차리면 죄책감 없이 조기에 대처할 수 있습니다.",
        "https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases"),
      ox("걷기든 자전거든, 어떤 신체활동이라도 전혀 안 하는 것보다는 정신건강에 낫다.", "O",
        "WHO는 어떤 활동이든 안 하는 것보다 낫고 많이 할수록 좋다고 안내합니다. 완벽한 계획을 기다리지 말고 오늘 조금이라도 움직여 보세요.",
        "https://www.who.int/news-room/fact-sheets/detail/physical-activity"),
      ox("자기돌봄으로 나아지지 않을 때 전문가의 도움을 구하는 것은 나약함의 표시다.", "X",
        "압도되는 느낌이 지속되고 스스로의 대처가 통하지 않으면 전문가에게 도움을 구하도록 권장됩니다. 도움 요청은 약함이 아니라 건강을 지키는 적극적 선택입니다.",
        "https://www.cdc.gov/mental-health/living-with/index.html"),
      // 🩺 의학 확인 권장
      ox("마음챙김 명상은 대체로 건강한 사람에게 안전하며, 불안·우울 개선에 중등도 근거가 있다.", "O",
        "NCCIH에 따르면 마음챙김 명상은 불안·우울 개선에 중등도 근거가 있고 건강한 사람에게 대체로 안전합니다. 하루 몇 분이라도 호흡에 집중해 보세요.",
        "https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety"),
      sa("메이요 클리닉이 스트레스 완화법으로 안내하는, 자세와 호흡으로 몸과 마음을 함께 이완시키는 인도 기원의 대표 수련은?",
        "요가",
        "메이요 클리닉은 심호흡·명상·점진적 근육 이완과 함께 요가처럼 몸과 마음을 이완시키는 활동이 스트레스 완화에 도움이 된다고 안내합니다.",
        "https://www.mayoclinic.org/healthy-lifestyle/stress-management/in-depth/stress-relievers/art-20047257"),
    ],
  },
]

export const QUIZ_AUDIENCES = [
  {
    key: 'general_adult',
    label: '일반 성인',
    emoji: '🧑',
    description: '누구에게나 맞는 범용 건강 상식 · WHO·CDC·질병관리청 등 출처 기반 55문항 (일부 🩺 의학 확인 권장)',
    topics: GENERAL_TOPICS,
  },
  {
    key: 'soldier_20s',
    label: '군인·20대 초반',
    emoji: '🪖',
    description: '군 장병·20대 초반 대상 건강 상식 (출처 검증 완료)',
    topics: TOPICS,
  },
  {
    key: 'worker',
    label: '근로자',
    emoji: '🧑‍💼',
    description: '직장인 대상 일상 건강 상식 (공공기관 자료)',
    topics: WORKER_TOPICS,
  },
]
