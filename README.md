# IDH_Node
"이런 영웅은 싫어" 모바일 게임 서버
SVN 저장소에서 Git 저장소로 이동되었습니다.


## 📱 프로젝트 소개
모바일 RPG 게임 "이런 영웅은 싫어"의 게임 서버입니다.


### ⚙️ 개발 환경
- `ubuntu 16.04-64
- `Node.js`
- `Socket.io`
- `Naver GamePot`
- `MySQL 5.x`
- `Redis`


### 🔨 파일 구조
- Main_cluster.js : DB, Socket, Redis, Http 서비스 연결 및 서비스 초기화
- Controller/Common : 아이템 정의와 자주 사용되는 함수 관련 파일 관리
- Controller/CSV : Resource/CSV에 txt 파일 읽어 서비스 기본 데이터 캐싱
- Controller/CSVManager.js : 기본 데이터 파일리스트 관리 및 초기화
- Controller/SessionManager.js : 유저 로그인과 캐싱된 유저 데이터 관리
- Programs : 프로젝트 관련 유틸리티(현재 에셋번들 암호화 batch 파일만 사용)

### 🔑 서비스 방식
클라이언트 소켓 요청 > Main_cluster.js Socket에서 해당 Contorller.OnPacket으로 전달 > 데이터 베이스 접근하여 CRUD > SessionManager에 캐싱된 유저 데이터 갱신 > 변경된 데이터 및 클라이언트에 필요한 정보 서버 응답


### 🖨 기타 문서 
- Packet 정의 : 관련문서/Server_Client socket 연동 테이블.xlsx
- ERDiagram : 관련문서/idh_ERDiagram.mwb
