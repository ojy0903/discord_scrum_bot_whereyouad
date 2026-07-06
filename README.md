# Discord 데일리 스크럼 알림봇

매주 정해진 요일·시간에 디스코드 채널로 데일리 스크럼 작성 알림을 자동 전송하는 봇입니다. 별도의 서버 없이 **외부 cron 서비스(cron-job.org) + GitHub Actions** 조합으로 동작합니다.

## 하는 일

- 매주 **월요일, 목요일 19:00 KST** 에 지정된 디스코드 채널로 알림 메시지를 전송합니다.
- 메시지에서 **프론트엔드 / 백엔드 역할(role)** 을 멘션해 해당 팀원들에게만 알림이 가도록 합니다.
- 알림 내용: 오늘 완료한 작업 / 계획한 작업 / 장애 요소 / 추가 논의 사항 공유 요청.

## 동작 방식

1. 외부 cron 서비스([cron-job.org](https://cron-job.org))가 정해진 시각에 GitHub API의 `repository_dispatch` 엔드포인트를 호출해 `scrum-reminder` 이벤트를 발생시킵니다.
   - GitHub Actions 내장 `schedule` cron 은 지연·스킵이 잦아 비활성화(주석 처리) 되어 있고, 외부 트리거를 메인 경로로 사용합니다.
   - 필요 시 GitHub Actions의 Run workflow 버튼(`workflow_dispatch`)으로 수동 실행도 가능합니다.
2. GitHub Secret `DISCORD_BOT_SECRET` 한 덩어리(.env 형식)에서 다음 값을 추출합니다.
   - `DISCORD_TOKEN` — 디스코드 봇 토큰
   - `CHANNEL_ID` — 알림을 보낼 채널 ID
   - `FRONT_ROLE_ID`, `BACK_ROLE_ID` — 멘션할 역할 ID
3. 값 중 하나라도 비어 있으면 워크플로우를 실패시켜 누락을 빠르게 감지합니다.
4. `jq` 로 메시지 페이로드를 만들고 `curl` 로 Discord REST API(`POST /channels/{channel.id}/messages`)에 전송합니다.
5. `allowed_mentions.roles` 에 두 역할 ID를 명시해 의도한 역할만 핑(@mention)되도록 제한합니다.
6. HTTP 응답 코드가 2xx 가 아니면 워크플로우가 실패하도록 처리합니다.

## 환경 변수

로컬 테스트 시 `.env.example` 을 참고해 `.env` 를 만들고, GitHub Actions에서는 동일 형식의 텍스트를 `DISCORD_BOT_SECRET` 시크릿에 통째로 저장합니다.

```
DISCORD_TOKEN=your-bot-token-here
CHANNEL_ID=알림을-보낼-채널-ID
FRONT_ROLE_ID=front-역할-ID
BACK_ROLE_ID=back-역할-ID
```

## 디스코드 봇 권한

- 봇이 해당 서버에 초대되어 있어야 합니다.
- 대상 채널에 대한 **View Channel**, **Send Messages**, **Mention @everyone, @here, and All Roles**(또는 해당 역할 멘션 허용) 권한이 필요합니다.

## 알림 주기 변경

알림 시각은 외부 cron 서비스(cron-job.org) 측에서 관리합니다. 해당 서비스 대시보드에서 호출 시각을 수정하세요.

GitHub Actions 내장 schedule 로 폴백하려면 `.github/workflows/scrum-reminder.yml` 에 주석 처리된 `cron` 라인을 다시 활성화하면 됩니다. cron 은 **UTC 기준**이므로 KST 로는 9시간을 더해 환산해야 합니다.
