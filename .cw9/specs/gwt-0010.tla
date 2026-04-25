---- MODULE GWT0010ForkNavSessionCreated ----

EXTENDS TLC

(* --algorithm GWT0010ForkNavSessionCreated

variables
    currentSessionIsTemp \in {TRUE, FALSE},
    newSessionIdPresent  \in {TRUE, FALSE},
    navigateCalled = FALSE,
    navigatedTo    = "none",
    replaceCalled  = FALSE,
    phase          = "Idle";

define

    PARENT_ID == "parent_session_id"
    NEW_ID    == "new_session_id"

    NavigateAlways ==
        (phase = "Handled" /\ newSessionIdPresent) =>
            (navigateCalled = TRUE /\ navigatedTo = NEW_ID)

    NoParentReplaceOnFork ==
        (phase = "Handled" /\ ~currentSessionIsTemp) => ~replaceCalled

    DistinctFromParent ==
        NEW_ID # PARENT_ID

    NavigateCalledAtMostOnce ==
        navigateCalled => navigatedTo = NEW_ID

    AllInvariants ==
        /\ NavigateAlways
        /\ NoParentReplaceOnFork
        /\ DistinctFromParent
        /\ NavigateCalledAtMostOnce

end define;

fair process handler = "handler"
begin
    ReceiveSessionCreated:
        if newSessionIdPresent then
            navigateCalled := TRUE;
            navigatedTo    := NEW_ID;
        end if;
    CheckReplace:
        if currentSessionIsTemp then
            replaceCalled := TRUE;
        end if;
    Finish:
        phase := "Handled";
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "62fc7e6e" /\ chksum(tla) = "da52c058")
VARIABLES pc, currentSessionIsTemp, newSessionIdPresent, navigateCalled, 
          navigatedTo, replaceCalled, phase

(* define statement *)
PARENT_ID == "parent_session_id"
NEW_ID    == "new_session_id"

NavigateAlways ==
    (phase = "Handled" /\ newSessionIdPresent) =>
        (navigateCalled = TRUE /\ navigatedTo = NEW_ID)

NoParentReplaceOnFork ==
    (phase = "Handled" /\ ~currentSessionIsTemp) => ~replaceCalled

DistinctFromParent ==
    NEW_ID # PARENT_ID

NavigateCalledAtMostOnce ==
    navigateCalled => navigatedTo = NEW_ID

AllInvariants ==
    /\ NavigateAlways
    /\ NoParentReplaceOnFork
    /\ DistinctFromParent
    /\ NavigateCalledAtMostOnce


vars == << pc, currentSessionIsTemp, newSessionIdPresent, navigateCalled, 
           navigatedTo, replaceCalled, phase >>

ProcSet == {"handler"}

Init == (* Global variables *)
        /\ currentSessionIsTemp \in {TRUE, FALSE}
        /\ newSessionIdPresent \in {TRUE, FALSE}
        /\ navigateCalled = FALSE
        /\ navigatedTo = "none"
        /\ replaceCalled = FALSE
        /\ phase = "Idle"
        /\ pc = [self \in ProcSet |-> "ReceiveSessionCreated"]

ReceiveSessionCreated == /\ pc["handler"] = "ReceiveSessionCreated"
                         /\ IF newSessionIdPresent
                               THEN /\ navigateCalled' = TRUE
                                    /\ navigatedTo' = NEW_ID
                               ELSE /\ TRUE
                                    /\ UNCHANGED << navigateCalled, 
                                                    navigatedTo >>
                         /\ pc' = [pc EXCEPT !["handler"] = "CheckReplace"]
                         /\ UNCHANGED << currentSessionIsTemp, 
                                         newSessionIdPresent, replaceCalled, 
                                         phase >>

CheckReplace == /\ pc["handler"] = "CheckReplace"
                /\ IF currentSessionIsTemp
                      THEN /\ replaceCalled' = TRUE
                      ELSE /\ TRUE
                           /\ UNCHANGED replaceCalled
                /\ pc' = [pc EXCEPT !["handler"] = "Finish"]
                /\ UNCHANGED << currentSessionIsTemp, newSessionIdPresent, 
                                navigateCalled, navigatedTo, phase >>

Finish == /\ pc["handler"] = "Finish"
          /\ phase' = "Handled"
          /\ pc' = [pc EXCEPT !["handler"] = "Done"]
          /\ UNCHANGED << currentSessionIsTemp, newSessionIdPresent, 
                          navigateCalled, navigatedTo, replaceCalled >>

handler == ReceiveSessionCreated \/ CheckReplace \/ Finish

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == handler
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(handler)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
