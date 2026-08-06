import type { CSSProperties } from 'react';
import Logo from './components/Logo';
import NavDrawer from './components/NavDrawer';
import NovaTrigger from './components/NovaTrigger';
import NovaPanel from './components/NovaPanel';
import RemindersBox from './components/RemindersBox';
import LeadModal from './components/LeadModal';
import HomeScreen from './components/screens/HomeScreen';
import CrmListScreen from './components/screens/CrmListScreen';
import CrmDetailScreen from './components/screens/CrmDetailScreen';
import DialingScreen from './components/screens/DialingScreen';
import StickySpotScreen from './components/screens/StickySpotScreen';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import { buildViewModel } from './viewModel';
import type { AppState, MastermindActions } from './state';

interface Props {
  state: AppState;
  actions: MastermindActions;
}

export default function Stage({ state, actions }: Props) {
  const vm = buildViewModel(state, actions.navigateTo);
  const { isMobile } = vm;

  const stageStyle: CSSProperties = {
    width: vm.stageWidth, height: vm.stageHeight, background: '#0A0B0D', position: 'relative',
    overflow: 'hidden', borderRadius: isMobile ? 40 : 4, border: isMobile ? '8px solid #1a1a1a' : '1px solid #22262B',
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  };

  return (
    <div style={stageStyle}>
      <Logo isMobile={isMobile} onClick={() => actions.goScreen('home')} />

      <NavDrawer
        open={state.navDrawerOpen}
        rows={vm.navRows}
        onToggle={actions.toggleDrawer}
        onClose={actions.closeDrawer}
      />

      <NovaTrigger
        cx={vm.cx}
        cy={vm.cy}
        circleSize={vm.circleSize}
        dragging={state.dragging}
        novaOpen={state.novaOpen}
        onPointerDown={actions.onCirclePointerDown}
        onPointerMove={actions.onCirclePointerMove}
        onPointerUp={actions.onCirclePointerUp}
      />

      <div style={vm.contentStyle}>
        {state.screen === 'home' && (
          <HomeScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} statGridStyle={vm.statGridStyle} statCards={vm.statCards} />
        )}

        {state.screen === 'crm-list' && (
          <CrmListScreen
            isMobile={isMobile}
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            filterChips={vm.filterChips}
            leadFilter={state.leadFilter}
            onFilter={actions.setFilter}
            filteredLeads={vm.filteredLeads}
            onSelectLead={actions.selectLead}
            onOpenAddModal={actions.openAddModal}
          />
        )}

        {state.screen === 'crm-detail' && (
          <CrmDetailScreen
            isMobile={isMobile}
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            selectedLead={vm.selectedLead}
            onBack={actions.backToList}
            onEdit={actions.openEditModal}
          />
        )}

        {state.screen === 'dialing' && (
          <DialingScreen dialCount={state.dialCount} dialGoal={state.dialGoal} onLogCall={actions.logCall} />
        )}

        {state.screen === 'sticky-spot' && (
          <StickySpotScreen
            newIdeaText={state.newIdeaText}
            newIdeaEst={state.newIdeaEst}
            onNewIdeaText={actions.onNewIdeaText}
            onNewIdeaEst={actions.onNewIdeaEst}
            onAdd={actions.addStickyIdea}
            stickyIdeas={state.stickyIdeas}
            onRemove={actions.removeStickyIdea}
          />
        )}

        {(state.screen === 'placeholder' ||
          !['home', 'crm-list', 'crm-detail', 'dialing', 'sticky-spot'].includes(state.screen)) && (
          <PlaceholderScreen isMobile={isMobile} label={state.placeholderLabel} />
        )}
      </div>

      {state.novaOpen && (
        <NovaPanel
          isMobile={isMobile}
          pos={state.novaPos || { x: vm.cx, y: vm.cy + 80 }}
          messages={state.novaMessages}
          input={state.novaInput}
          onClose={actions.closeNova}
          onDragPointerDown={actions.onNovaPointerDown}
          onDragPointerMove={actions.onNovaPointerMove}
          onDragPointerUp={actions.onNovaPointerUp}
          onInputChange={actions.onNovaInputChange}
          onKeyDown={actions.onNovaKeyDown}
          onSend={actions.sendNova}
        />
      )}

      <RemindersBox isMobile={isMobile} />

      {state.showLeadModal && state.editingLead && (
        <LeadModal
          editingLead={state.editingLead}
          onClose={actions.closeModal}
          onStopProp={actions.stopProp}
          onField={actions.editField}
          onSave={actions.saveLead}
        />
      )}
    </div>
  );
}
