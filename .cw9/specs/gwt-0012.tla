---- MODULE gwt_0012_fork_settings_localStorage_not_cleared_on_nav ----

EXTENDS Sequences, FiniteSets, TLC

CONSTANTS
    WatchedKeys,
    ParentSession,
    ForkedSession,
    InitValue

(* --algorithm ForkSettingsLocalStorageNotClearedOnNav

variables
    storeHasValues \in {TRUE, FALSE},
    localStore     = [k \in WatchedKeys |-> InitValue],
    snapshot       = [k \in WatchedKeys |-> InitValue],
    removedKeys       = {},
    clearedAll        = FALSE,
    overwrittenKeys   = {},
    sessionStorageSet = FALSE,
    navExecuted       = FALSE,
    currentSession    = ParentSession,
    phase             = "init";

define

    LocalStoragePersistAcrossNav ==
        navExecuted =>
            \A k \in WatchedKeys : localStore[k] = snapshot[k]

    NoRemoveItemOnWatchedKeys ==
        removedKeys \cap WatchedKeys = {}

    NoClearAllCalled ==
        ~clearedAll

    NoSetItemOnWatchedKeys ==
        overwrittenKeys \cap WatchedKeys = {}

    SessionStorageScopedToPendingId ==
        sessionStorageSet =>
            phase \in { "pending_session_id_set",
                        "callback_invoked",
                        "nav_complete",
                        "complete" }

    AllInvariants ==
        /\ LocalStoragePersistAcrossNav
        /\ NoRemoveItemOnWatchedKeys
        /\ NoClearAllCalled
        /\ NoSetItemOnWatchedKeys
        /\ SessionStorageScopedToPendingId

end define;

fair process navigator = "nav"
begin
    InitLocalStore:
        if storeHasValues then
            localStore := [k \in WatchedKeys |-> InitValue];
        else
            localStore := [k \in WatchedKeys |-> "absent"];
        end if;

    SnapshotStore:
        snapshot := localStore;
        phase    := "snapshotted";

    ReceiveSessionCreatedEvent:
        phase := "session_created";

    WriteSessionStorage:
        sessionStorageSet := TRUE;
        phase := "pending_session_id_set";

    InvokeNavCallback:
        currentSession := ForkedSession;
        phase := "callback_invoked";

    MarkNavComplete:
        navExecuted := TRUE;
        phase := "nav_complete";

    Terminate:
        phase := "complete";

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "443c9200" /\ chksum(tla) = "6bde7baf")
VARIABLES pc, storeHasValues, localStore, snapshot, removedKeys, clearedAll, 
          overwrittenKeys, sessionStorageSet, navExecuted, currentSession, 
          phase

(* define statement *)
LocalStoragePersistAcrossNav ==
    navExecuted =>
        \A k \in WatchedKeys : localStore[k] = snapshot[k]

NoRemoveItemOnWatchedKeys ==
    removedKeys \cap WatchedKeys = {}

NoClearAllCalled ==
    ~clearedAll

NoSetItemOnWatchedKeys ==
    overwrittenKeys \cap WatchedKeys = {}

SessionStorageScopedToPendingId ==
    sessionStorageSet =>
        phase \in { "pending_session_id_set",
                    "callback_invoked",
                    "nav_complete",
                    "complete" }

AllInvariants ==
    /\ LocalStoragePersistAcrossNav
    /\ NoRemoveItemOnWatchedKeys
    /\ NoClearAllCalled
    /\ NoSetItemOnWatchedKeys
    /\ SessionStorageScopedToPendingId


vars == << pc, storeHasValues, localStore, snapshot, removedKeys, clearedAll, 
           overwrittenKeys, sessionStorageSet, navExecuted, currentSession, 
           phase >>

ProcSet == {"nav"}

Init == (* Global variables *)
        /\ storeHasValues \in {TRUE, FALSE}
        /\ localStore = [k \in WatchedKeys |-> InitValue]
        /\ snapshot = [k \in WatchedKeys |-> InitValue]
        /\ removedKeys = {}
        /\ clearedAll = FALSE
        /\ overwrittenKeys = {}
        /\ sessionStorageSet = FALSE
        /\ navExecuted = FALSE
        /\ currentSession = ParentSession
        /\ phase = "init"
        /\ pc = [self \in ProcSet |-> "InitLocalStore"]

InitLocalStore == /\ pc["nav"] = "InitLocalStore"
                  /\ IF storeHasValues
                        THEN /\ localStore' = [k \in WatchedKeys |-> InitValue]
                        ELSE /\ localStore' = [k \in WatchedKeys |-> "absent"]
                  /\ pc' = [pc EXCEPT !["nav"] = "SnapshotStore"]
                  /\ UNCHANGED << storeHasValues, snapshot, removedKeys, 
                                  clearedAll, overwrittenKeys, 
                                  sessionStorageSet, navExecuted, 
                                  currentSession, phase >>

SnapshotStore == /\ pc["nav"] = "SnapshotStore"
                 /\ snapshot' = localStore
                 /\ phase' = "snapshotted"
                 /\ pc' = [pc EXCEPT !["nav"] = "ReceiveSessionCreatedEvent"]
                 /\ UNCHANGED << storeHasValues, localStore, removedKeys, 
                                 clearedAll, overwrittenKeys, 
                                 sessionStorageSet, navExecuted, 
                                 currentSession >>

ReceiveSessionCreatedEvent == /\ pc["nav"] = "ReceiveSessionCreatedEvent"
                              /\ phase' = "session_created"
                              /\ pc' = [pc EXCEPT !["nav"] = "WriteSessionStorage"]
                              /\ UNCHANGED << storeHasValues, localStore, 
                                              snapshot, removedKeys, 
                                              clearedAll, overwrittenKeys, 
                                              sessionStorageSet, navExecuted, 
                                              currentSession >>

WriteSessionStorage == /\ pc["nav"] = "WriteSessionStorage"
                       /\ sessionStorageSet' = TRUE
                       /\ phase' = "pending_session_id_set"
                       /\ pc' = [pc EXCEPT !["nav"] = "InvokeNavCallback"]
                       /\ UNCHANGED << storeHasValues, localStore, snapshot, 
                                       removedKeys, clearedAll, 
                                       overwrittenKeys, navExecuted, 
                                       currentSession >>

InvokeNavCallback == /\ pc["nav"] = "InvokeNavCallback"
                     /\ currentSession' = ForkedSession
                     /\ phase' = "callback_invoked"
                     /\ pc' = [pc EXCEPT !["nav"] = "MarkNavComplete"]
                     /\ UNCHANGED << storeHasValues, localStore, snapshot, 
                                     removedKeys, clearedAll, overwrittenKeys, 
                                     sessionStorageSet, navExecuted >>

MarkNavComplete == /\ pc["nav"] = "MarkNavComplete"
                   /\ navExecuted' = TRUE
                   /\ phase' = "nav_complete"
                   /\ pc' = [pc EXCEPT !["nav"] = "Terminate"]
                   /\ UNCHANGED << storeHasValues, localStore, snapshot, 
                                   removedKeys, clearedAll, overwrittenKeys, 
                                   sessionStorageSet, currentSession >>

Terminate == /\ pc["nav"] = "Terminate"
             /\ phase' = "complete"
             /\ pc' = [pc EXCEPT !["nav"] = "Done"]
             /\ UNCHANGED << storeHasValues, localStore, snapshot, removedKeys, 
                             clearedAll, overwrittenKeys, sessionStorageSet, 
                             navExecuted, currentSession >>

navigator == InitLocalStore \/ SnapshotStore \/ ReceiveSessionCreatedEvent
                \/ WriteSessionStorage \/ InvokeNavCallback
                \/ MarkNavComplete \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == navigator
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(navigator)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
