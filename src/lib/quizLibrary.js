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
      mc('금연을 시작했을 때 몸에서 나타나는 변화로 가장 적절한 것은?',
        ['시간이 지나며 심박수·혈압이 안정되고 폐 기능이 점차 회복된다', '금연해도 건강엔 아무 변화가 없다', '금연 직후 폐가 즉시 완전히 원상복구된다', '금연하면 오히려 심장병 위험이 높아진다'], 0,
        '금연 후 시간이 지나며 심혈관·호흡기 지표가 개선되고 질병 위험이 점차 줄어듭니다.', SRC.smokeCessation),
      ox('전자담배(궐련형 포함)는 유해물질이 없어 건강에 해가 없다.', 'X',
        '전자담배·궐련형 담배에도 니코틴과 여러 유해물질이 들어 있어 안전하지 않습니다.', SRC.ecigKhan),
      mc('흡연이 높이는 건강 위험으로 보기 어려운 것은?',
        ['폐암·여러 암', '심뇌혈관질환', '만성폐쇄성폐질환(COPD)', '운동 없이 뼈가 튼튼해짐'], 3,
        '흡연은 다양한 암·심혈관·호흡기 질환 위험을 높이며 뼈 건강에도 해롭습니다.', SRC.smokeCessation),
      ox('금연은 한 번 실패하면 다시 시도해도 소용이 없다.', 'X',
        '금연은 여러 번의 시도 끝에 성공하는 경우가 많아 재시도가 중요합니다.', SRC.noSmokeGuide),
      sa('금연을 결심한 이유나 금연 후 기대하는 변화를 한 가지 적어보세요.',
        '예: 가족 건강, 체력 회복, 비용 절약, 냄새·기침 개선',
        '개인적 동기를 분명히 하면 금연 유지에 도움이 됩니다.', SRC.noSmokeGuide),
    ],
  },
  {
    key: 'nutrition', title: '영양', emoji: '🥗', category: 'DIET',
    questions: [
      mc('나트륨(소금)을 과도하게 섭취할 때 관련이 큰 건강 문제는?',
        ['고혈압 등 심뇌혈관 부담', '시력 향상', '수면 시간 증가', '근육량 자동 증가'], 0,
        '나트륨 과다 섭취는 혈압 상승과 관련되어 심뇌혈관 건강에 부담을 줄 수 있습니다.', SRC.kdcaSodium),
      ox('가당 음료·과자 등 당류가 많은 식품을 자주 먹어도 체중·대사 건강엔 영향이 없다.', 'X',
        '당류를 과다 섭취하면 열량 과잉·체중 증가 등 대사 건강에 영향을 줄 수 있습니다.', SRC.kdcaNutrition),
      mc('균형 잡힌 식사에 대한 설명으로 가장 적절한 것은?',
        ['채소·과일·통곡물·단백질을 골고루, 가공식품·짠 음식은 줄인다', '탄수화물을 완전히 끊는 것이 항상 최선이다', '한 가지 음식만 먹는 것이 건강에 좋다', '끼니를 자주 거를수록 건강해진다'], 0,
        '특정 영양소를 극단적으로 제한하기보다 다양한 식품을 골고루 먹는 것이 권장됩니다.', SRC.kdcaNutrition),
      ox('아침을 거르면 누구나 무조건 살이 빠지고 건강해진다.', 'X',
        '결식은 오히려 폭식·불규칙한 식습관으로 이어질 수 있어 개인 상황에 맞는 규칙적 식사가 중요합니다.', SRC.kdcaNutrition),
      sa('오늘 식단에서 건강하게 바꿔볼 점을 한 가지 적어보세요.',
        '예: 물 자주 마시기, 채소 한 접시 더, 짠 국물 줄이기, 야식 줄이기',
        '작은 변화를 꾸준히 실천하는 것이 식습관 개선의 핵심입니다.', SRC.kdcaNutrition),
    ],
  },
  {
    key: 'activity', title: '신체활동', emoji: '🏃', category: 'WALKING',
    questions: [
      mc('성인에게 권장되는 유산소 신체활동량으로 가장 적절한 것은?',
        ['주 150분 이상 중강도(또는 75분 이상 고강도)', '한 달에 한 번 격렬한 운동', '운동은 전혀 필요 없음', '하루 10시간 이상 앉아 있기'], 0,
        '성인은 일주일에 중강도 150분 이상의 유산소 활동이 권장됩니다.', SRC.kdcaExercise),
      ox('오래 앉아 있는 좌식 생활도 그 자체로 건강 위험을 높일 수 있다.', 'O',
        '장시간 앉아 있는 습관은 운동과 별개로 건강에 좋지 않아 자주 일어나 움직이는 것이 좋습니다.', SRC.kdcaPhysical),
      mc('바빠서 한 번에 오래 운동하기 어려울 때 좋은 방법은?',
        ['10분씩 나눠서 여러 번 움직여도 도움이 된다', '한 번에 못 하면 아예 안 하는 게 낫다', '주말에 한꺼번에 몰아서만 해야 한다', '걷기는 운동으로 전혀 효과가 없다'], 0,
        '짧게 나눠서 하는 신체활동도 쌓이면 건강에 도움이 됩니다.', SRC.kdcaExercise),
      ox('근력운동은 필요 없고 유산소만 하면 충분하다.', 'X',
        '유산소와 함께 주 2회 이상의 근력운동이 권장됩니다.', SRC.kdcaExercise),
      sa('일상에서 몸을 조금 더 움직일 방법을 한 가지 적어보세요.',
        '예: 계단 이용, 한 정거장 걷기, 앉은 지 1시간마다 일어나기',
        '생활 속 작은 움직임을 늘리는 것도 훌륭한 신체활동입니다.', SRC.kdcaPhysical),
    ],
  },
  {
    key: 'sleep', title: '수면', emoji: '😴', category: 'SLEEP',
    questions: [
      mc('일반적인 성인의 권장 수면 시간으로 가장 적절한 것은?',
        ['하루 7~9시간', '하루 2~3시간', '하루 12시간 이상 고정', '수면 시간은 건강과 무관'], 0,
        '대부분의 성인은 하루 7~9시간의 수면이 권장됩니다(개인차 있음).', SRC.nhisSleepLack),
      ox('잠들기 직전 스마트폰의 밝은 빛은 수면을 방해할 수 있다.', 'O',
        '자기 전 밝은 빛(블루라이트)은 멜라토닌 분비를 방해해 잠드는 데 어려움을 줄 수 있습니다.', SRC.nhisMelatonin),
      mc('수면위생(잘 자기 위한 습관)으로 적절한 것은?',
        ['일정한 시각에 자고 일어나며 늦은 카페인을 피한다', '매일 다른 시각에 자고 일어난다', '자기 직전 진한 커피를 마신다', '잠이 안 오면 침대에서 몇 시간이고 스마트폰을 본다'], 0,
        '규칙적인 수면 시간과 카페인·빛 관리는 수면의 질에 도움이 됩니다.', SRC.nhisSleepHygiene),
      ox('수면 부족이 쌓여도 건강에는 별다른 영향이 없다.', 'X',
        '만성적인 수면 부족은 집중력 저하뿐 아니라 여러 건강 문제와 관련됩니다.', SRC.nhisSleepLack),
      sa('더 잘 자기 위해 오늘 바꿔볼 습관을 한 가지 적어보세요.',
        '예: 취침 1시간 전 스마트폰 끄기, 기상 시각 고정, 낮잠 줄이기',
        '작은 수면 습관의 변화가 수면의 질을 높입니다.', SRC.nhisSleepHygiene),
    ],
  },
  {
    key: 'mind', title: '마음건강', emoji: '🧘', category: 'MINDCARE',
    questions: [
      mc('번아웃(소진)의 신호로 보기 적절한 것은?',
        ['만성적인 피로·의욕 저하·일에 대한 냉소', '갑작스런 체력 향상', '집중력이 계속 좋아짐', '스트레스가 전혀 없는 상태'], 0,
        '번아웃은 지속적인 피로, 무기력, 냉소적 태도 등으로 나타날 수 있습니다.', SRC.nhisBurnout),
      ox('스트레스는 무조건 나쁜 것이라 완전히 없애야만 건강하다.', 'X',
        '적당한 스트레스는 누구에게나 있으며, 없애기보다 잘 관리하고 대처하는 것이 중요합니다.', SRC.nhisBurnout),
      mc('마음이 힘들 때 도움이 되는 행동으로 가장 적절한 것은?',
        ['규칙적인 생활·운동, 주변과 대화, 필요 시 전문 상담 이용', '혼자 계속 참고 아무에게도 말하지 않기', '수면과 식사를 계속 미루기', '힘든 감정을 무조건 무시하기'], 0,
        '규칙적인 생활과 사회적 지지, 전문가의 도움은 마음건강 회복에 도움이 됩니다.', SRC.counsel109),
      ox('마음이 많이 힘들 때는 혼자 버티는 것이 가장 좋은 방법이다.', 'X',
        '힘들 때 가족·친구나 상담(정신건강복지센터, 자살예방상담 109 등)에 도움을 요청하는 것이 중요합니다.', SRC.counsel109),
      sa('스트레스를 풀거나 마음을 돌보는 데 나에게 도움이 되는 방법을 한 가지 적어보세요.',
        '예: 산책, 심호흡·명상, 좋아하는 음악, 가까운 사람과 대화',
        '자신에게 맞는 이완·회복 방법을 알아두면 스트레스 관리에 도움이 됩니다.'),
    ],
  },
]

export const QUIZ_AUDIENCES = [
  {
    key: 'general_adult',
    label: '일반 성인',
    emoji: '🧑',
    description: '누구에게나 맞는 범용 건강 상식 (초안 — 의학 검수·출처 확정 예정)',
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
