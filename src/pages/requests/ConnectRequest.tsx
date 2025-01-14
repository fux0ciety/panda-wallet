import { useContext, useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { ThirdPartyAppRequestData, WhitelistedApp } from '../../App';
import { Button } from '../../components/Button';
import { ButtonContainer, Divider, HeaderText, Text } from '../../components/Reusable';
import { Show } from '../../components/Show';
import { BottomMenuContext } from '../../contexts/BottomMenuContext';
import { useBsv } from '../../hooks/useBsv';
import { useOrds } from '../../hooks/useOrds';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useTheme } from '../../hooks/useTheme';
import { storage } from '../../utils/storage';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 4rem;
`;

const Icon = styled.img<{ size: string }>`
  width: ${(props) => props.size};
  height: ${(props) => props.size};
  margin: 0 0 1rem 0;
  border-radius: 0.5rem;
`;

export type ConnectRequestProps = {
  thirdPartyAppRequestData: ThirdPartyAppRequestData | undefined;
  whiteListedApps: WhitelistedApp[];
  popupId: number | undefined;
  onDecision: () => void;
};
export const ConnectRequest = (props: ConnectRequestProps) => {
  const { thirdPartyAppRequestData, whiteListedApps, popupId, onDecision } = props;
  const { theme } = useTheme();
  const context = useContext(BottomMenuContext);
  const { addSnackbar } = useSnackbar();
  const [isDecided, setIsDecided] = useState(false);
  const { bsvPubKey, identityPubKey } = useBsv();
  const { ordPubKey } = useOrds();

  useEffect(() => {
    if (!context) return;
    context.hideMenu();

    return () => context.showMenu();
  }, [context]);

  useEffect(() => {
    if (isDecided) return;
    if (thirdPartyAppRequestData && !thirdPartyAppRequestData.isAuthorized) return;
    if (!bsvPubKey || !ordPubKey) return;
    if (!window.location.href.includes('localhost')) {
      chrome.runtime.sendMessage({
        action: 'userConnectResponse',
        decision: 'approved',
        pubKeys: { bsvPubKey, ordPubKey, identityPubKey },
      });
      storage.remove('connectRequest');
      // We don't want the window to stay open after a successful connection. The 10ms timeout is used because of some weirdness with how chrome.sendMessage() works
      setTimeout(() => {
        if (popupId) chrome.windows.remove(popupId);
      }, 10);
    }
  }, [bsvPubKey, ordPubKey, popupId, thirdPartyAppRequestData, isDecided, identityPubKey]);

  useEffect(() => {
    const onbeforeunloadFn = () => {
      if (popupId) chrome.windows.remove(popupId);
    };

    window.addEventListener('beforeunload', onbeforeunloadFn);
    return () => {
      window.removeEventListener('beforeunload', onbeforeunloadFn);
    };
  }, [popupId]);

  const handleConnectDecision = async (approved: boolean) => {
    if (chrome.runtime) {
      if (approved) {
        storage.set({
          whitelist: [
            ...whiteListedApps,
            {
              domain: thirdPartyAppRequestData?.domain,
              icon: thirdPartyAppRequestData?.appIcon,
            },
          ],
        });
        chrome.runtime.sendMessage({
          action: 'userConnectResponse',
          decision: 'approved',
          pubKeys: { bsvPubKey, ordPubKey, identityPubKey },
        });
        addSnackbar(`Approved`, 'success');
      } else {
        chrome.runtime.sendMessage({
          action: 'userConnectResponse',
          decision: 'declined',
        });

        addSnackbar(`Declined`, 'error');
      }
    }

    setIsDecided(true);

    storage.remove('connectRequest');
    setTimeout(() => {
      if (popupId) chrome.windows.remove(popupId);
    }, 2000);
  };

  return (
    <Show when={!thirdPartyAppRequestData?.isAuthorized}>
      <Container>
        <Icon size="5rem" src={thirdPartyAppRequestData?.appIcon} />
        <HeaderText theme={theme} style={{ width: '90%' }}>
          {thirdPartyAppRequestData?.appName}
        </HeaderText>
        <Text theme={theme} style={{ marginBottom: '1rem' }}>
          {thirdPartyAppRequestData?.domain}
        </Text>
        <Divider />
        <Text style={{ color: theme.white, margin: 0 }}>
          The app is requesting to view your wallet balance and request approval for transactions.
        </Text>

        <Divider />
        <ButtonContainer style={{ position: 'absolute', bottom: 0 }}>
          <Button
            theme={theme}
            type="warn"
            label="Cancel"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              handleConnectDecision(false);
              onDecision();
            }}
          />
          <Button
            theme={theme}
            type="primary"
            label="Connect"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              handleConnectDecision(true);
              onDecision();
            }}
          />
        </ButtonContainer>
      </Container>
    </Show>
  );
};
